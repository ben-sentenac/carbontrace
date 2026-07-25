import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { chmod, rm, writeFile } from 'node:fs/promises';
import { RaplReader } from './RaplReader.js';
import { raplProbe } from './rapl-probe.js';
import { createRaplPackages, nowNs } from '../../utils/test-utils.js';


test('RaplReader - wrap without a known bound is reported, not silently zeroed', async () => {
    const temp = path.join(os.tmpdir(), `rapl-unhandled-wrap-${process.pid}`);
    try {
        // No maxRange => the fixture does not create max_energy_range_uj,
        // so the probe yields maxEnergyUj = null (CPU without a known bound).
        const pkg = await createRaplPackages(temp, 'intel-rapl:0', {
            name: 'package-0',
            energy: 19000000n,
        });

        const probe = await raplProbe(temp);
        const reader = new RaplReader({ probe, log: 'silent' });

        // Prime.
        await reader.sample(nowNs(0));

        // Simulate a wrap: the counter jumps backwards.
        await chmod(pkg.files.energyPath, 0o644);
        await writeFile(pkg.files.energyPath, String(1000000n), 'utf8');

        const sample = await reader.sample(nowNs(1.0));

        assert.ok(sample);
        // We cannot compute the energy of this tick without a bound:
        // the delta must stay 0 (we invent nothing).
        assert.strictEqual(sample.deltaUj, 0);
        assert.strictEqual(sample.packages[0].deltaUj, 0);
        // But the event must be visible, not lost:
        assert.strictEqual(sample.unhandledWraps, 1);
        assert.strictEqual(sample.packages[0].unhandledWraps, 1);
        // And it must NOT be counted as a corrected wrap:
        assert.strictEqual(sample.wraps, 0);
        assert.strictEqual(sample.packages[0].wraps, 0);
    } finally {
        await rm(temp, { recursive: true, force: true });
    }
});