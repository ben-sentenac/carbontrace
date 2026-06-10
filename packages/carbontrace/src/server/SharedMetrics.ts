export type MonitorStatus = "idle" | "running" | "stopped" | "error";

export interface SharedMetricsSnapshot {
    status: MonitorStatus;
    updatedAt: string | null;
    samplesCount: number;
    lastSample: unknown | null;
}