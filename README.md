# CarbonTrace

![Node.js CI](https://github.com/ben-sentenac/carbontrace/actions/workflows/carbontrace.yaml/badge.svg)

> **CPU energy and carbon auditing for Linux processes.**
>
> Measure CPU energy consumption and carbon footprint for one or multiple processes using Linux RAPL when available, with an empirical fallback when hardware counters are unavailable.

---

# Features

Current capabilities:

*  CPU energy audit
*  Carbon footprint estimation
*  Linux RAPL support
*  Empirical fallback model
*  Single process audit
*  Multi-process audit
*  Machine-readable JSON output
*  Programmatic API

Planned:

*  Continuous monitor
*  HTTP API
*  Dashboard

---

# What it does

CarbonTrace measures the CPU energy consumed by one or multiple Linux processes and converts that energy into a carbon footprint (gCO2e).

It reads energy directly from the Linux RAPL interface when available and falls back to an empirical model when RAPL is unavailable (VMs, containers, unsupported systems).

## Scope

| Measured                     | Not measured (yet) |
| ---------------------------- | ------------------ |
|  CPU energy                 |  RAM              |
|  Process CPU attribution    |  Disk I/O         |
|  Carbon footprint           |  Network I/O      |
|  RAPL or empirical fallback | GPU              |

---

# Requirements

* Linux
* Node.js >= 18
* `/proc`
* `/sys/class/powercap` for RAPL support

RAPL permissions may require root privileges or read access to `energy_uj`.

---

# Installation

```bash
npm install -g @carbontrace/carbontrace
```

or

```bash
npm install @carbontrace/energy-core
```

---

# CLI Usage

## Audit a process

```bash
carbontrace audit --pid 1234
```

## Audit multiple processes

```bash
carbontrace audit --pid 1234 --pid 5678
```

## Custom duration

```bash
carbontrace audit --pid 1234 --duration 10
```

## Custom sampling interval

```bash
carbontrace audit --pid 1234 --tick 100
```

## JSON output

```bash
carbontrace audit --pid 1234 --json
```

## Empirical fallback

```bash
carbontrace audit \
    --pid 1234 \
    --pidleW 8 \
    --pmaxW 65
```

or

```bash
carbontrace audit \
    --pid 1234 \
    --tdp 65
```

---

# CLI Options

| Option             | Description                       |
| ------------------ | --------------------------------- |
| `--pid <pid>`      | Target PID (repeatable)           |
| `--duration <s>`   | Audit duration                    |
| `--tick <ms>`      | Sampling interval                 |
| `--pidleW <w>`     | Idle power for empirical model    |
| `--pmaxW <w>`      | Maximum power for empirical model |
| `--tdp <w>`        | TDP fallback                      |
| `--ef <gCO2e/kWh>` | Emission factor                   |
| `--json`           | JSON output                       |
| `-v`               | Verbose                           |
| `-vv`              | Verbose + debug metadata          |
| `--debug-meta`     | Show raw metadata                 |
| `--debug-timing`   | Scheduler timings                 |

---

# Programmatic API

```ts
import {
    audit,
    createSamplers,
} from "@carbontrace/energy-core";

const target = {
    kind: "process-group",
    pids: [1234, 5678],
};

const samplers = await createSamplers(
    target,
    {
        pidleWatts: 8,
        pmaxWatts: 65,
    },
);

const result = await audit({
    pid: 1234,
    target,
    durationSeconds: 10,
    tickMs: 1000,
    samplers,
    emissionFactor_gCO2ePerKWh: 52,
    debugTiming: false,
});

console.log(result.processCpuEnergyJoules);
```

---

# Architecture

```text
                    RaplReader
                         │
                  EmpiricalReader
                         │
                    EnergyReader
                         │
 /proc/stat ─────────► CpuReader
                         │

/proc/<pid>/stat ──► ProcessCpuReader[]
                         │
                         ▼
         aggregateProcessCpuSnapshots
                         │
                         ▼
                  processCpuGroup
                         │

               fixedRateTicks()
                         │

                AuditAccumulator
                         │

                    AuditResult
```

---

# How it works

1. Detect available energy source.
2. Read host CPU energy.
3. Read host CPU activity.
4. Read process CPU activity.
5. Aggregate process groups.
6. Attribute process energy share.
7. Convert energy to carbon footprint.

---

# RAPL permissions

```bash
ls -la /sys/class/powercap/*/energy_uj
```

Temporary access:

```bash
sudo chmod o+r /sys/class/powercap/*/energy_uj
```

Example udev rule:

```bash
echo 'SUBSYSTEM=="powercap", ACTION=="add", RUN+="/bin/chmod o+r %S%p/energy_uj"' \
| sudo tee /etc/udev/rules.d/51-rapl.rules
```

When unavailable, CarbonTrace automatically switches to the empirical model.

---

# Limitations

* Linux only
* CPU only
* Process attribution is statistical
* RAPL support depends on hardware
* Empirical mode accuracy depends on calibration
* No lifecycle analysis
* Results should be interpreted as indicative

---

# Intended Use Cases

* Eco-design audits
* Compare implementations
* Detect CPU-heavy workloads
* Research
* Educational purposes

---

# Non Goals

* Full LCA
* Cloud accounting
* Cost estimation
* User-facing carbon labels

---

# Roadmap

Current:

*  Audit engine
*  Multi-process support
*  JSON output
* Programmatic API

Next:

*  Continuous monitor
*  Ring buffer
*  Monitor session

Future:

*  HTTP API
*  Dashboard
*  Exporters

---

# License

MIT

**CarbonTrace estimates operational CPU emissions only.**

**Results should be interpreted as indicative, not absolute.**
