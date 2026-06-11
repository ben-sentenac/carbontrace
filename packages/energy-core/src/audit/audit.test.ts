import test from "node:test";
import assert from "node:assert/strict";
import { audit, type AuditOptions } from "./audit.js";
import type { Samplers } from "../sampling/sampling.js";



function processSample(pid:number, deltaActive: bigint) {
    return {
        ok: true as const,
        primed:true,
        pid,
        cpuTicks:{
            unit:"jiffies" as const,
            deltaActive
        }
    }
}

function deadProcessSample() {
    return {
        ok:false as const,
        error: "file_not_found"
    };
}

function createSamplers(samples:Array<unknown>):Samplers {
    return {
        energyReader:undefined,
        cpuReader:undefined,
        processCpuReaders: samples.map(sample => ({
            sample: async () => sample,
        })) as Samplers["processCpuReaders"],
    };
}

function createAuditOptions(partial:Partial<AuditOptions>):AuditOptions {
    return {
        pid:123,
        durationSeconds:0.05,
        tickMs:10,
        samplers:createSamplers([processSample(123,1n)]),
        emissionFactor_gCO2ePerKWh:50,
        debugTiming:false,
        debugMeta:true,
        ...partial
    };
}

function createDeadSamplers(): Samplers {
    return {
        energyReader: undefined,
        cpuReader: undefined,
        processCpuReaders: [
            {
                sample: async () => deadProcessSample(),
            },
        ] as Samplers["processCpuReaders"],
    };
}

test("audit ends duration for a live single process", async () => {

    const result = await audit(
        createAuditOptions({
            pid:123,
            target:{ kind:"process", pid:123},
            samplers:createSamplers([processSample(123,1n)])
        })
    );

    assert.equal(result.pid, 123);
    assert.deepEqual(result.targetPids, [123]);
    assert.equal(result.meta?.endReason, "duration");
    assert.equal(result.meta?.targetProcessCount, 1);
    assert.equal(result.meta?.processDeadSamples, 0);
});

test("audit keeps running for a process group when one process is dead", async () => {
    const result = await audit(
        createAuditOptions({
            pid: 123,
            target: { kind: "process-group", pids: [123, 456] },
            samplers: createSamplers([
                processSample(123, 1n),
                deadProcessSample(),
            ]),
        }),
    );

    assert.equal(result.pid, 123);
    assert.deepEqual(result.targetPids, [123, 456]);
    assert.equal(result.meta?.endReason, "duration");
    assert.equal(result.meta?.targetProcessCount, 2);
    assert.ok((result.meta?.processDeadSamples ?? 0) > 0);
});


test("audit ends with process_died when single target dies", async () => {
    const result = await audit(
        createAuditOptions({
            pid: 123,
            target: {
                kind: "process",
                pid: 123,
            },
            samplers: createDeadSamplers(),
        }),
    );

    assert.equal(result.pid, 123);
    assert.deepEqual(result.targetPids, [123]);

    assert.equal(result.meta?.targetProcessCount, 1);
    assert.ok((result.meta?.processDeadSamples ?? 0) > 0);

    assert.equal(result.meta?.endReason, "process_died");
});