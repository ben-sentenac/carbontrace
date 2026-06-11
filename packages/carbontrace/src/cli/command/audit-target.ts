import type { AuditTarget } from "@carbontrace/energy-core";

export function buildAuditTarget(pids: number[]): AuditTarget {
    if (pids.length === 1) {
        return {
            kind: "process",
            pid: pids[0],
        };
    }

    return {
        kind: "process-group",
        pids,
    };
}

export function formatAuditTarget(pids: number[]): string {
    if (pids.length === 1) {
        return `PID:${pids[0]}`;
    }

    return `PIDs:${pids.join(",")}`;
}