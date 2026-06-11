export interface MonitorSample {
    timestamp: string;
    hostCpuEnergyJoules:number;
    processCpuEnergyJoules: number;
    processCpuEnergyShare: number;
    hostCpuCarbon_gCO2e: number;
    processCpuCarbon_gCO2e: number;
    isActive: boolean;
}    