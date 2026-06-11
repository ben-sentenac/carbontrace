import { RingBuffer } from "./RingBuffer.js";
import type { MonitorSample } from "./MonitorSample.js";

export interface MonitorSessionOptions {
    capacity: number;
}


export class MonitorSession {
    readonly samples: RingBuffer<MonitorSample>;

    constructor(options: MonitorSessionOptions) {
        this.samples = new RingBuffer<MonitorSample>(options.capacity);
    }

    push(sample: MonitorSample): void {
        this.samples.push(sample);
    }

    snapshot(): MonitorSample[] {
        return this.samples.values();
    }

    clear(): void {
        this.samples.clear();
    }

    get size(): number {
        return this.samples.size;
    }

    get capacity(): number {
        return this.samples.capacity;
    }

    get isFull(): boolean {
        return this.samples.isFull;
    }
    
    get latestSample(): MonitorSample | undefined {
        return this.samples.latest();
    }
}