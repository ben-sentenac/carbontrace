import type {
    ProcessCpuGroupSnapshot,
    ProcessCpuSampleResult,
} from "./ProcessCpuGroupSnapshot.js";

export function aggregateProcessCpuSnapshots(
    snapshots: ProcessCpuSampleResult[],
): ProcessCpuGroupSnapshot {
    let totalDeltaActiveTicks = 0n;
    let aliveProcesses = 0;
    let deadProcesses = 0;
    let primedProcesses = 0;

    for (const snapshot of snapshots) {
        if (snapshot.ok) {
            aliveProcesses++;

            if (snapshot.primed) {
                primedProcesses++;
                totalDeltaActiveTicks += snapshot.cpuTicks.deltaActive;
            }
        } else {
            deadProcesses++;
        }
    }

    return {
        ok: true,
        processes: snapshots,
        totalDeltaActiveTicks,
        aliveProcesses,
        deadProcesses,
        primedProcesses,
    };
}