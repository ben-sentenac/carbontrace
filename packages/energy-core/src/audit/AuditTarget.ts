export interface SingleProcessTarget {
    kind:"process";
    pid:number;
}

export interface ProcessGroupTarget {
    kind:"process-group";
    pids:number[];
}

export type AuditTarget = SingleProcessTarget | ProcessGroupTarget;