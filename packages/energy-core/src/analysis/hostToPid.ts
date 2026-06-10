export interface HostToPidAttributionInput {
    hostEnergyJoules: number;
    hostCpuActiveTicks: bigint;
    processCpuActiveTicks: bigint;
}

export interface HostToPidAttributionSuccess {
    ok: true;
    cpuShare: number;
    processEnergyJoules: number;
}

export interface HostToPidAttributionError {
    ok: false;
    reason: string;
}

export type HostToPidAttributionResult =
    | HostToPidAttributionSuccess
    | HostToPidAttributionError;

function clamp01(x: number): number {
    return Math.min(Math.max(x, 0), 1);
}
export function attributeHostEnergyToPid(input: HostToPidAttributionInput): HostToPidAttributionResult {
    const { hostEnergyJoules, hostCpuActiveTicks, processCpuActiveTicks } = input;
    if (!Number.isFinite(hostEnergyJoules) || hostEnergyJoules < 0) {
        return {
            ok: false,
            reason: "invalid_host_energy"
        }
    }

    if (hostCpuActiveTicks <= 0n) {
        return {
            ok: false,
            reason: "no_host_cpu_activity"
        }
    }
    if (processCpuActiveTicks < 0n) {
        return {
            ok: false,
            reason: "invalid_process_cpu_activity"
        }
    }

    const cpuShare = Number(processCpuActiveTicks) / Number(hostCpuActiveTicks);
    const safeCpuShare = clamp01(cpuShare); //clamp between 0 and 1
    const processEnergyJoules = hostEnergyJoules * safeCpuShare;

    return {
        ok: true,
        cpuShare: safeCpuShare,
        processEnergyJoules
    }
}