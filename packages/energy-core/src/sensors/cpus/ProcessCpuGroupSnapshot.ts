import type { ProcessCpuReader } from "./ProcessCpuReader.js";

export type ProcessCpuSampleResult =
    Awaited<ReturnType<ProcessCpuReader["sample"]>>;

export interface ProcessCpuGroupSnapshot {
    ok: true;
    processes: ProcessCpuSampleResult[];
    totalDeltaActiveTicks: bigint;
    aliveProcesses: number;
    deadProcesses: number;
    primedProcesses: number;
}