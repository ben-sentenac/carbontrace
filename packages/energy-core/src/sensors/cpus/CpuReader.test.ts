import test from "node:test";
import assert from "node:assert/strict";
import { CpuReader, parseProcStat, computeCpuUtilization } from "./CpuReader.js";
import { clampDt } from "../../timers/timing.js";
import { rm, writeFile } from "node:fs/promises";
import process from 'node:process';
import path from "node:path";
import os from "node:os";
import { createStatFileUnderControl, nowNs as generateNowNs } from "../../utils/test-utils.js";

test('CpuReader test suite', async (t) => {
    //peu probable mais si pour une obscure raison absent ou invalide
  await t.test("parseProcStat: KO if don't exist or invalid", async () => {
    const notfound = await parseProcStat('/does/not/exist');

    assert.equal(notfound.ok, false);

    assert.equal(notfound.error, 'file_not_found');

    const invalidFile = path.join(os.tmpdir(), `stat-invalid-${process.pid}`);

    try {
        await writeFile(invalidFile, 'invalid content');

        const invalid = await parseProcStat(invalidFile);

        assert.equal(invalid.ok, false);

        assert.equal(invalid.error, 'invalid_file_content');
    } finally {
        await rm(invalidFile, { force: true });
    }
});
    await t.test('parseProcStat: OK', async (t) => {
        let statFile: string | undefined;
        try {
            const stats = {
                user: 1000,
                nice: 200,
                system: 500,
                idle: 2000
            }
            statFile = await createStatFileUnderControl(os.tmpdir(), stats);
            const parsed = await parseProcStat(statFile);
            if (parsed && !('error' in parsed)) {
                assert.equal(typeof parsed.timeStamp, 'string');
                assert.equal(parsed?.aggregate?.user, 1000n);
                assert.equal(parsed?.aggregate?.nice, 0n);
                assert.equal(parsed?.aggregate?.system, 500n);
                assert.equal(parsed?.aggregate?.idle, 2000n);
                assert.equal(Array.isArray(parsed.perCpu), true);
                assert.equal(parsed.perCpu.length, 1);
                assert.deepStrictEqual(parsed.aggregate, parsed.perCpu[0]);
            }
        } finally {
            if (statFile) {
                await rm(statFile, { recursive: true, force: true });
            }
        }
    });

    await t.test('computeCpuUtilization OK', () => {
        const stats = computeCpuUtilization({
            user: 5n,
            iowait: 5n,
            idle: 100n,
            nice: 0n,
            system: 150n,
            irq: 200n,
            softirq: 0n,
            steal: 0n,
        });

        assert.equal(stats.active, 355n);
        assert.equal(stats.idle, 105n);
        assert.equal(stats.total, 460n);
    });

    await t.test('CpuReader.sample OK', async () => {
        let statFilePath: string | undefined = '';
        const temp = os.tmpdir();
        try {
            const stat1 = {
                user: 1000,
                nice: 200,
                system: 500,
                idle: 2000
            }
            statFilePath = await createStatFileUnderControl(temp, stat1);
            const reader = new CpuReader({ statFilePath, log: 'debug' });

            const nowNs = process.hrtime.bigint();
            const sample1 = await reader.sample(nowNs);

            assert.ok(sample1.ok);
            assert.equal(sample1.internalClampedDt, 0);
            assert.equal(sample1.primed, false);
            assert.equal(sample1.cpuUtilization, 0);
            assert.equal(sample1.cpuTicks.deltaTotalTicks, 0n);

            statFilePath = await createStatFileUnderControl(temp, { user: 2500, nice: 200, system: 600, idle: 2200 });

            const nowNs2 = nowNs + generateNowNs(2.0);//1 sec plus tard

            const sample2 = await reader.sample(nowNs2);

            assert.ok(sample2.ok);
            assert.ok(sample2.primed);
            assert.ok(sample2.internalClampedDt >= 0.001 && sample2.internalClampedDt <= 10);
            assert.equal(sample2.internalClampedDt, clampDt(2));
            assert.equal(sample2.cpuTicks.deltaTotalTicks, 1500n);
            assert.equal(sample2.cpuUtilization, 1);



        } finally {
            if (statFilePath) {
                await rm(statFilePath, { recursive: true, force: true });
            }
        }



    });
    await t.test('CpuReader.sample KO on invalid stat file', async (t) => {
        let statFile: string | undefined;
        try {
            const temp = os.tmpdir();
            statFile = path.join(temp, `stat-invalid-${process.pid}`);
            await writeFile(statFile, 'invalid content');
            const reader = new CpuReader({ statFilePath: statFile });
            const nowNs = process.hrtime.bigint();
            const sample = await reader.sample(nowNs);
            assert.equal(sample.ok, false);
            assert.equal(sample.error, 'invalid_file_content');
        } finally {
            if (statFile) {
                await rm(statFile, { recursive: true, force: true });
            }
        }
    });
});
