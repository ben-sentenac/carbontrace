import type { ProcessStatSnapshot } from "./ProcessCpuReader.js";

export interface ProcessCpuGroupSnapshot {
    ok: true;

    processes: ProcessStatSnapshot[];

    totalDeltaActiveTicks: bigint;

    aliveProcesses: number;

    deadProcesses: number;
}