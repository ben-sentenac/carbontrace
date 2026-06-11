import type { AuditTarget } from "./AuditTarget.js";

export function normalizeTarget(target: AuditTarget):number[] {
    switch (target.kind) {
        case "process":
            return [target.pid];

        case "process-group":
            return target.pids;
    }
}