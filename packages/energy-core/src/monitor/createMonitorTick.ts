import type { MonitorTickResult } from "./MonitorTickResult.js";
import { createMonitorSample } from "./createMonitorSample.js";

export interface CreateMonitorTickInput {
    timestamp: string;

    hostCpuEnergyJoules: number;

    totalHostCpuActiveTicks: bigint;
    totalProcessCpuActiveTicks: bigint;

    emissionFactor_gCO2ePerKWh: number;
}

export function createMonitorTick(
    input: CreateMonitorTickInput,
): MonitorTickResult {
    const processCpuEnergyShare =
        input.totalHostCpuActiveTicks > 0n
            ? Number(input.totalProcessCpuActiveTicks) /
              Number(input.totalHostCpuActiveTicks)
            : 0;

    const processCpuEnergyJoules =
        input.hostCpuEnergyJoules * processCpuEnergyShare;

    return {
        sample: createMonitorSample({
            timestamp: input.timestamp,
            hostCpuEnergyJoules: input.hostCpuEnergyJoules,
            processCpuEnergyJoules,
            processCpuEnergyShare,
            emissionFactor_gCO2ePerKWh:
                input.emissionFactor_gCO2ePerKWh,
            isActive: input.totalProcessCpuActiveTicks > 0n,
        }),
    };
}