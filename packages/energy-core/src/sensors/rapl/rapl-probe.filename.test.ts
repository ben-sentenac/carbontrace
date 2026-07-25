import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { raplProbe } from "./rapl-probe.js";


test('raplProbe reads max_energy_range_uj (real kernel filename)', async () => {
    const tmp = path.join(os.tmpdir(),`rapl-probe-filename-${process.pid}`);
    const pkgDir = path.join(tmp,'intel-rapl:0');
    try {
        await fs.mkdir(pkgDir,{recursive:true});
        await fs.writeFile(path.join(pkgDir,'name'),'package-0','utf-8');
        await fs.writeFile(path.join(pkgDir, 'energy_uj'), '123456789', 'utf8');
        // real name from kernel :
        await fs.writeFile(path.join(pkgDir, 'max_energy_range_uj'), '262143328850', 'utf8');

        const probe = await raplProbe(tmp);

        assert.strictEqual(probe.status, 'OK');
        assert.strictEqual(probe.packages.length, 1);
        assert.notStrictEqual(
            probe.packages[0].maxEnergyUj,
            null,
            'maxEnergyUj doit être renseigné depuis max_energy_range_uj',
        );
    } finally {
        await fs.rm(tmp,{recursive:true,force:true});
    }
})