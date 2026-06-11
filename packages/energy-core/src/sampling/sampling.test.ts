import test from "node:test";
import assert from "node:assert/strict";
import { collectSamples, type Samplers } from "./sampling.js";


function createProcessCpuSample(deltaActive: bigint) {
    return {
        ok:true as const,
        primed:true,
        cpuTicks: {
            deltaActive,
            totalActive:deltaActive
        }
    };
}

type ProcessCpuReaderLike = {
    sample: () => Promise<ReturnType<typeof createProcessCpuSample>>;
};

test("collectSamples: must collect sample without reader", async (t) => {
    const samples = await collectSamples({},0n);
    assert.strictEqual(samples.energy,null);
    assert.strictEqual(samples.cpu,null);
    assert.strictEqual(samples.processCpu,null);
});

test("collectSample derives legacy processCpu from first processCpu sample", async() => {
    const firstSample = createProcessCpuSample(3n);
    const secondSample = createProcessCpuSample(5n);

    const firstReader = {
        sample: async () => firstSample,
    };

    const secondReader = {
        sample: async () => secondSample
    };

    const processCpuReaders = [
        firstReader,
        secondReader,
    ] satisfies ProcessCpuReaderLike[];

    const samples = await collectSamples({
        processCpuReaders:processCpuReaders as unknown as NonNullable<Samplers>["processCpuReaders"] 
    },10n)
});

test("collectSamples handles dead process samples in processCpuGroup", async () => {
    const aliveSample = {
        ok: true as const,
        primed: true,
        cpuTicks: {
            deltaActive: 3n,
            totalActive: 3n,
        },
    };

    const deadSample = {
        ok: false as const,
        error: "file_not_found" as const,
    };

    const readers = [
        {
            sample: async () => aliveSample,
        },
        {
            sample: async () => deadSample,
        },
    ];

    const samples = await collectSamples(
        {
            processCpuReaders:
                readers as unknown as NonNullable<Samplers["processCpuReaders"]>,
        },
        123n,
    );

    assert.equal(samples.processCpu, aliveSample);

    assert.equal(samples.processCpuGroup?.aliveProcesses, 1);
    assert.equal(samples.processCpuGroup?.deadProcesses, 1);
    assert.equal(samples.processCpuGroup?.primedProcesses, 1);
    assert.equal(samples.processCpuGroup?.totalDeltaActiveTicks, 3n);
});