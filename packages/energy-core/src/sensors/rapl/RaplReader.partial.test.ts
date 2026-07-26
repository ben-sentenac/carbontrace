import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { chmod, rm, writeFile } from 'node:fs/promises';
import { RaplReader } from './RaplReader.js';
import { raplProbe } from './rapl-probe.js';
import { createRaplPackages, nowNs } from '../../utils/test-utils.js';

// Moment 1 : un package est déjà illisible au démarrage (au probe).
// Le matériel expose 2 packages, un seul est lisible.
// Choix honnête : expectedPackages doit rester à 2.

test('RaplReader - package unreadable at probe time is still counted as expected', async() => {
    const tmp = path.join(os.tmpdir(), `rapl-partial-probe-${process.pid}`);
    try {

        const [p0,p1] = await Promise.all([
             createRaplPackages(tmp,'intel-rapl:0',{name:'package-0',energy:1_000_000n}),
            createRaplPackages(tmp,'intel-rapl:1',{name:'package-0',energy:2_000_000n})
        ]);

        // package-1 illisible AVANT le probe → écarté à la construction.
        await chmod(p1.files.energyPath,0o000);

        const probe = await raplProbe(tmp);
        const reader = new RaplReader({probe,log:'silent'});

        await reader.sample(nowNs(0)); //prime
        await writeFile(p0.files.energyPath,String(1_500_000n),'utf-8');
        const sample = await reader.sample(nowNs(1.0));

        assert.ok(sample);
        //materiel a détecté 2 packa    ges, même si un a été écarté au démarage
        assert.strictEqual(sample.expectedPackages,2);
        //on en a lu qu'un seul
        assert.strictEqual(sample.readablePackages,1);

    } finally {
        await rm(tmp,{recursive:true,force:true});
    }
});

test('RaplReader - package becoming unreadable mid-run lowers readablePackage only', async() => {
    const tmp = path.join(os.tmpdir(), `rapl-partial-midrun-${process.pid}`);
    try {

        const [p0,p1] = await Promise.all([
             createRaplPackages(tmp,'intel-rapl:0',{name:'package-0',energy:1_000_000n}),
            createRaplPackages(tmp,'intel-rapl:1',{name:'package-0',energy:2_000_000n})
        ]);

        const probe = await raplProbe(tmp);
        const reader = new RaplReader({probe,log:'silent'});

        await reader.sample(nowNs(0)); //prime 2 ppackages connus

         // package-1 casse aprés probe.
        await chmod(p1.files.energyPath,0o000);

        await writeFile(p0.files.energyPath,String(1_500_000n),'utf-8');
        const sample = await reader.sample(nowNs(1.0));

        assert.ok(sample);
        //2 packages attendus
        assert.strictEqual(sample.expectedPackages,2);
        //un seul a pu etre lu sur ce tick
        assert.strictEqual(sample.readablePackages,1);

    } finally {
        await rm(tmp,{recursive:true,force:true});
    }
});