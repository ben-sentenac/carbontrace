import test from "node:test";
import assert from "node:assert/strict";
import { collectMonitorSample } from "./collectMonitorSample.js";
import type { Samplers } from "../sampling/sampling.js";

function createSamplers(): Samplers {
    return {
        energyReader: {
            sample: async () => ({
                ok: true as const,
                primed: true,
                source: "rapl",
                deltaUj:100_000_000,
                deltaJ: 100,
                internalClampedDt:0,
                packages:[],
                wraps:0,
                
            }),
        } as unknown as Samplers["energyReader"],
        cpuReader: {
            sample: async () => ({
                ok: true as const,
                primed: true,
                cpuTicks: {
                    unit: "jiffies" as const,
                    deltaActiveTicks: 200n,
                    deltaIdleTicks:0n,
                    deltaTotalTicks:200n
                },
                internalClampedDt:0,
                cpuUtilization:1
            }),
        } as unknown as Samplers["cpuReader"],
        processCpuReaders: [
            {
                sample: async () => ({
                    ok: true as const,
                    primed: true,
                    pid: 123,
                    cpuTicks: {
                        unit: "jiffies" as const,
                        deltaActive: 50n,
                    },
                }),
            },
        ] as Samplers["processCpuReaders"],
    };
}

test("collectMonitorSample collects samples and creates a monitor sample", async () => {
    const sample = await collectMonitorSample({
        samplers: createSamplers(),
        emissionFactor_gCO2ePerKWh: 3600,
    });

    assert.equal(sample.hostCpuEnergyJoules, 100);
    assert.equal(sample.processCpuEnergyShare, 0.25);
    assert.equal(sample.processCpuEnergyJoules, 25);
    assert.equal(sample.hostCpuCarbon_gCO2e, 0.1);
    assert.equal(sample.processCpuCarbon_gCO2e, 0.025);
    assert.equal(sample.isActive, true);
    assert.equal(typeof sample.timestamp, "string");
});