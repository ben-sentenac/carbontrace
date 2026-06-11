export interface MonitorSample {
    timestamp: string;
    hostCpuEnergyJoules:number;
    processCpuEnergyJoules: number;
    processCpuEnergyShare: number;
    hostCpuCarbon_gCOe: number;
    processCpuCarbon_gCOe: number;
    isActive: boolean;
}    