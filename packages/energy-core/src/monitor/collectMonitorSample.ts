import { collectSamples, type Samplers } from "../sampling/sampling.js";
import { nowNs } from "../timers/timing.js";
import type { MonitorSample } from "./MonitorSample.js";
import { createMonitorTick } from "./createMonitorTick.js";

export interface CollectMonitorSampleOptions {
    samplers: Samplers;
    emissionFactor_gCO2ePerKWh: number;
}

export async function collectMonitorSample(
    options: CollectMonitorSampleOptions,
): Promise<MonitorSample> {
    const samples = await collectSamples(options.samplers, nowNs());

    const hostCpuEnergyJoules =
        samples.energy?.ok && samples.energy.primed
            ? samples.energy.deltaJ
            : 0;

    const totalHostCpuActiveTicks =
        samples.cpu?.ok && samples.cpu.primed
            ? samples.cpu.cpuTicks.deltaActiveTicks
            : 0n;

    const totalProcessCpuActiveTicks =
        samples.processCpuGroup
            ? samples.processCpuGroup.totalDeltaActiveTicks
            : samples.processCpu?.ok
                ? samples.processCpu.cpuTicks.deltaActive
                : 0n;

    const result = createMonitorTick({
        timestamp: new Date().toISOString(),
        hostCpuEnergyJoules,
        totalHostCpuActiveTicks,
        totalProcessCpuActiveTicks,
        emissionFactor_gCO2ePerKWh:
            options.emissionFactor_gCO2ePerKWh,
    });

    return result.sample;
}