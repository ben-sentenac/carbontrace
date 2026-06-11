import type { MonitorSample } from "./MonitorSample.js";

export interface CreateMonitorSampleInput {
    timestamp: string;

    hostCpuEnergyJoules: number;
    processCpuEnergyJoules: number;
    processCpuEnergyShare: number;

    emissionFactor_gCO2ePerKWh: number;

    isActive: boolean;
}

const JOULES_PER_KWH = 3_600_000;

export function createMonitorSample(input:CreateMonitorSampleInput):MonitorSample {

    const hostCpuEnergyKwh = input.hostCpuEnergyJoules / JOULES_PER_KWH;
    const processCpuEnergyKWh = input.processCpuEnergyJoules / JOULES_PER_KWH;

    return {
        timestamp:input.timestamp,

        hostCpuEnergyJoules:input.hostCpuEnergyJoules,
        processCpuEnergyJoules:input.processCpuEnergyJoules,
        processCpuEnergyShare:input.processCpuEnergyShare,

        hostCpuCarbon_gCO2e:hostCpuEnergyKwh * input.emissionFactor_gCO2ePerKWh,
        processCpuCarbon_gCO2e:processCpuEnergyKWh * input.emissionFactor_gCO2ePerKWh,
        isActive:input.isActive

    };
}