export interface SlidingWindowOptions {
    windowSize: number; // number of samples to keep
}

export interface SlidingWindowInput {
   hostEnergyJoules:number;
   hostCpuActiveTicks: bigint;
   processCpuActiveTicks: bigint;
}

interface WindowCpuTicks {
    unit: "jiffies";
    hostActive: string;
    processActive: string;
}

interface WindowEnergy {
    unit: "joules";
    hostJoules: number;
}

export interface SlidingWindowSuccess {
    ok: true;
    cpuShare: number;
    processEnergyJoules: number;
    samples: number;
    windowCpuTicks: WindowCpuTicks;
    windowEnergy: WindowEnergy;
    isActive: boolean;
}

export interface SlidingWindowError {
    ok: false;
    reason: string;
    samples: number;
}

export type SlidingWindowResult =
    | SlidingWindowSuccess
    | SlidingWindowError;


function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

export class HostToPidSlidingWindow {
    private windowSize:number;
    private buffer: SlidingWindowInput[] = [];


    constructor(options:SlidingWindowOptions) {
        if(!Number.isFinite(options.windowSize) || options.windowSize <= 0) {
            throw new Error("Sliding window size must be a positive integer");
        }
        this.windowSize = options.windowSize;


    }

    push(sample:SlidingWindowInput): SlidingWindowResult {
        
        this.buffer.push(sample);

        if(this.buffer.length > this.windowSize) {
            this.buffer.shift();
        }

        //accumulate values

        let sumEnergyJoules = 0;
        let sumHostCpuActiveTicks = 0n;
        let sumProcessCpuActiveTicks = 0n;

        for(const entry of this.buffer) {
            sumEnergyJoules += entry.hostEnergyJoules;
            sumHostCpuActiveTicks += entry.hostCpuActiveTicks;
            sumProcessCpuActiveTicks += entry.processCpuActiveTicks;
        }

        if(sumHostCpuActiveTicks === 0n) {
            return {
                ok:false,
                reason:"no_host_cpu_activity",
                samples: this.buffer.length
            }
        }
        const cpuShare = Number(sumProcessCpuActiveTicks) / Number(sumHostCpuActiveTicks);
        const safeCpuShare = clamp01(cpuShare) ; //clamp between 0 and 1
        const processEnergyJoules = sumEnergyJoules * safeCpuShare;
        return {
            ok:true,
            cpuShare: safeCpuShare,
            processEnergyJoules,
            samples: this.buffer.length,
            windowCpuTicks: {
                unit:"jiffies",
                hostActive: sumHostCpuActiveTicks.toString(),
                processActive: sumProcessCpuActiveTicks.toString()
            },
            windowEnergy: {
                unit: "joules",
                hostJoules: sumEnergyJoules
            },
            isActive: sumProcessCpuActiveTicks > 0n      
        }

    }
}
    