import type { Samplers } from "../sampling/sampling.js";
import { fixedRateTicks } from "../timers/scheduler.js";
import { collectMonitorSample } from "./collectMonitorSample.js";
import type { MonitorSession } from "./MonitorSession.js";

export interface MonitorControllerOptions {
    session: MonitorSession;
    samplers: Samplers;

    emissionFactor_gCO2ePerKWh: number;

    tickMs?: number;
    signal?: AbortSignal;
}

export class MonitorController {
    #running = false;

    readonly session: MonitorSession;
    readonly samplers: Samplers;
    readonly tickMs: number;
    readonly emissionFactor_gCO2ePerKWh: number;
    readonly signal?: AbortSignal;

    constructor(options: MonitorControllerOptions) {
        this.session = options.session;
        this.samplers = options.samplers;
        this.tickMs = options.tickMs ?? 1000;
        this.emissionFactor_gCO2ePerKWh =
            options.emissionFactor_gCO2ePerKWh;
        this.signal = options.signal;
    }

    get isRunning(): boolean {
        return this.#running;
    }

    async start(): Promise<void> {
        if (this.#running) {
            return;
        }

        this.#running = true;

        try {
            for await (const _tick of fixedRateTicks({
                periodMs: this.tickMs,
                signal: this.signal,
            })) {
                if (!this.#running) {
                    break;
                }

                const sample = await collectMonitorSample({
                    samplers: this.samplers,
                    emissionFactor_gCO2ePerKWh:
                        this.emissionFactor_gCO2ePerKWh,
                });

                this.session.push(sample);
            }
        } finally {
            this.#running = false;
        }
    }

    stop(): void {
        this.#running = false;
    }
}