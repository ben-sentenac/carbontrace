# carbontrace — Points à corriger pour un outil d'audit solide

**Revue du code source v0.0.1**
**Auteur :** Benoît Sentenac-Réou

---

## Ce qui est déjà solide

Avant les corrections, ce qui fonctionne bien et ne doit pas être touché :

- **RaplReader** — lecture BigInt, gestion wraparound du compteur, priming pattern. Correct.
- **ProcessCpuReader** — détection de redémarrage de process via `starttime`. Cas edge rare, bien traité.
- **Architecture** — `RaplReader` et `EmpiricalEnergyReader` implémentent la même interface `sample()`. Le reste du code est agnostique. Bon design.

---

## Corrections prioritaires — faussent les résultats

---

### BUG-01 · Fractions TDP par défaut incorrectes

**Fichier :** `EmpiricalEnergyReader.ts` lignes 63–64

```typescript
idleFraction = 0.07,  // 7% du TDP au repos
maxFraction = 0.55,   // 55% du TDP à pleine charge
```

**Problème**

Sur un Xeon E5-2609 TDP 85W, ça donne `P_idle = 6W` et `P_max = 47W`.
Les mesures terrain donnent **15–25W au repos** et **65–75W à pleine charge** sur ce type de CPU.
Le mode fallback sous-estime d'un facteur 2 à 3.

C'est le mode utilisé sur tous les serveurs sans RAPL (Windows, containers, AMD ancien) — soit **la majorité des machines auditées en pratique**.

**Pourquoi c'est grave**

Un rapport produit avec ces valeurs par défaut est systématiquement faux sans que l'utilisateur s'en aperçoive. Si le client utilise les chiffres dans son rapport CSRD, les données sont non défendables.

**Correction**

Remplacer les fractions par des valeurs validées sur mesures SPECpower :

```typescript
idleFraction = 0.20,  // 20% du TDP — calibré SPECpower serveurs x86
maxFraction = 0.90,   // 90% du TDP — charge soutenue
```

Ou, mieux : ajouter une calibration automatique au démarrage. Mesurer l'énergie host au repos pendant 5–10 secondes avant de démarrer l'audit, et déduire `pidleW` depuis cette mesure. Ce serait la valeur la plus précise possible sans RAPL.

---

### BUG-02 · Facteur d'émission par défaut trompeur

**Fichier :** `audit-command.ts` ligne 98

```typescript
const emissionFactor = values.ef ? ... : (config?.emissionFactor?.factor ?? 475);
```

**Problème**

475 gCO₂e/kWh est une ancienne moyenne mondiale (~2019).
Les valeurs réelles nationales 2024 :

| Pays | gCO₂e/kWh |
|---|---|
| France | 52 |
| Norvège | 28 |
| Allemagne | 385 |
| Pologne | 730 |
| Monde | ~475 |

Un audit réalisé en France avec la valeur par défaut **surestime l'empreinte carbone d'un facteur 9**.
Le client reçoit un chiffre 9× trop élevé, sans aucun avertissement dans la sortie.

**Pourquoi c'est grave**

C'est la valeur que le client copie dans son rapport RSE/CSRD. Une erreur de facteur 9 est indéfendable si un auditeur externe vérifie la méthodologie.

**Correction**

Deux options, à combiner :

1. Supprimer la valeur par défaut — forcer l'utilisateur à fournir `--ef` explicitement ou via le fichier de config. Erreur claire si manquant.
2. Afficher un avertissement visible quand la valeur par défaut est utilisée :

```
⚠ Emission factor: 475 gCO2e/kWh (DEFAULT — world average 2019)
  France: 52 | Germany: 385 | Use --ef <value> or set in config.
```

Ajouter `--country fr|de|uk|us|...` qui mappe automatiquement sur le bon facteur national.

---

### BUG-03 · ProcessCpuReader ignore les threads

**Fichier :** `ProcessCpuReader.ts` ligne 182

```typescript
const current_app_ticks = (utime ?? 0n) + (stime ?? 0n);
// cutime et cstime sont lus mais non utilisés
```

**Problème**

`utime + stime` = ticks du thread principal uniquement.
`cutime + cstime` = ticks cumulés des threads enfants **terminés** (disponibles dans `/proc/[pid]/stat`).
Les threads enfants **vivants** sont dans `/proc/[pid]/task/*/stat`.

Pour MySQL (multi-threadé), nginx (workers séparés), ou tout process Node.js avec `worker_threads`, la consommation réelle des threads actifs est complètement ignorée. La mesure peut être **50 à 80% sous-estimée** sur ces process.

**Correction**

```typescript
// Étape 1 — inclure les threads terminés
const current_app_ticks = utime + stime + cutime + cstime;

// Étape 2 (optionnel, plus précis) — lire les threads vivants
// Lister /proc/[pid]/task/ et sommer les utime+stime de chaque thread
const taskDir = `/proc/${pid}/task`;
const threads = await fs.readdir(taskDir);
for (const tid of threads) {
    const threadStat = await parsePidStatFile(`${taskDir}/${tid}/stat`);
    ticks += threadStat.utime + threadStat.stime;
}
```

---

## Corrections importantes — limitent l'utilité en audit

---

### AMÉLIORATION-01 · Pas d'extrapolation dans la sortie

**Fichier :** `audit-command.ts` — section affichage résultat

**Problème**

La sortie donne des Joules pour la durée mesurée. C'est la valeur brute.
Ce que le client veut savoir : **combien ça coûte par an, combien de CO₂ par an**.

Actuellement l'utilisateur doit calculer lui-même :
```
watts = joules / durationSeconds
kWh/an = watts × heures_par_an / 1000
kgCO₂/an = kWh/an × ef / 1000
```

Aucun outil d'audit ne livre des Joules bruts à son client.

**Correction**

Ajouter les options `--hours-per-day` et `--days-per-year` (ou `--annual-hours`) et calculer l'extrapolation dans la sortie :

```
-----------EXTRAPOLATION----------

Annual hours   : 2 250h (9h/day × 250 days)
Process kWh/an : 37.2 kWh
Process CO₂/an : 1.93 kgCO2eq
Process cost   : 6.40 €/an  (at 0.172 €/kWh)
```

---

### AMÉLIORATION-02 · Pas de timeline tick par tick

**Problème**

La sortie est un seul agrégat sur toute la durée de mesure. Si la consommation monte brutalement à la 30e seconde (un cron qui se déclenche, un pic de requêtes), c'est invisible.

Pour un audit, la timeline est souvent plus intéressante que la moyenne : elle permet d'identifier les pics, de croiser avec les logs applicatifs, de prouver qu'un job batch dure 3h et non 1h.

**Correction**

Ajouter un flag `--csv` ou `--timeline` qui écrit un fichier CSV tick par tick :

```csv
timestamp_ms,host_watts,process_watts,process_share_pct
0,24.3,5.1,21.0
1000,26.8,6.2,23.1
2000,71.4,58.3,81.6   ← pic backup visible ici
```

---

### AMÉLIORATION-03 · Tick par défaut trop lent

**Fichier :** `audit-command.ts` ligne 91

```typescript
const tickMs = parsePositiveNumberFromCommand('--tick', values.tick, 1000);
```

**Problème**

1000ms entre chaque sample. Sur une mesure de 10 secondes (durée par défaut), le priming consomme le premier tick — il ne reste que 9 samples utiles. Pour des workloads à charge variable (backup, antivirus), la variance inter-tick est élevée et la moyenne sur 9 points est peu fiable.

**Correction**

Passer le défaut à 250ms. Sur 60 secondes, ça donne 239 samples — variance statistiquement stable. Sur des machines légères, l'overhead de lire `/proc/stat` et `/proc/[pid]/stat` toutes les 250ms est négligeable (< 0.1ms par lecture).

---

### AMÉLIORATION-04 · RaplReader n'inclut pas la DRAM

**Fichier :** `RaplReader.ts` — filtre sur les packages

**Problème**

RAPL expose plusieurs domaines :
- `intel-rapl:0` → `package` (CPU + LLC) ← **seul domaine lu actuellement**
- `intel-rapl:0:0` → `core`
- `intel-rapl:0:1` → `uncore` **ou** `dram` selon le CPU

Sur un serveur avec 32 Go de RAM ECC, la DRAM consomme **10–15W** en permanence.
Ce domaine est disponible via RAPL sur la plupart des Xeon Broadwell+, mais ignoré.

**Correction**

Dans `rapl-probe.ts`, lors du scan des sous-domaines, vérifier le `name` du domaine :
```typescript
if (name === 'dram') {
    // inclure dans la lecture
}
```
Et sommer `package + dram` dans l'énergie totale host. Afficher les deux séparément en mode `-v`.

---

### AMÉLIORATION-05 · Impossible de mesurer un groupe de process

**Problème**

nginx fonctionne avec un master et N workers (PIDs distincts). MySQL a des threads de connexion séparés. `--pid` n'accepte qu'un seul PID.

Pour auditer un service réel, il faut souvent mesurer le groupe de process qui le compose.

**Correction**

Ajouter `--pids 1204,1205,1206` qui crée un `ProcessCpuReader` par PID et somme les ticks actifs.
Alternative plus ergonomique : `--pgrp <pgid>` ou `--comm nginx` pour regrouper par nom de process.

---

## Tableau de synthèse

| ID | Fichier | Sévérité | Impact | Effort |
|---|---|---|---|---|
| BUG-01 | `EmpiricalEnergyReader.ts` | 🔴 Critique | Résultats faux × 2–3 en mode fallback | Faible |
| BUG-02 | `audit-command.ts` | 🔴 Critique | Empreinte CO₂ fausse × 9 par défaut | Faible |
| BUG-03 | `ProcessCpuReader.ts` | 🔴 Critique | Sous-estimation 50–80% sur process multi-threadés | Moyen |
| AMÉLIORATION-01 | `audit-command.ts` | 🟡 Important | Sortie inutilisable pour un rapport sans calcul manuel | Faible |
| AMÉLIORATION-02 | `audit.ts` | 🟡 Important | Pas de détection de pics, pas de croisement avec logs | Moyen |
| AMÉLIORATION-03 | `audit-command.ts` | 🟡 Important | Mesures courtes peu fiables statistiquement | Trivial |
| AMÉLIORATION-04 | `RaplReader.ts` | 🟢 Utile | DRAM ignorée (~10–15W manquants sur serveurs) | Moyen |
| AMÉLIORATION-05 | `audit-command.ts` | 🟢 Utile | Impossible d'auditer nginx/MySQL en conditions réelles | Moyen |

---

## Ce qu'il faut corriger en premier

Les BUG-01, BUG-02 et BUG-03 peuvent produire des rapports factuellement incorrects sans que l'utilisateur le sache. Ce sont les trois corrections à faire avant toute utilisation en production. Le reste améliore l'ergonomie et la précision, mais ne compromet pas la validité des résultats.

---

*Revue réalisée sur le code source fourni — carbontrace v0.0.1*
