import test from "node:test";
import assert from "node:assert/strict";
import { MonitorSession } from "./MonitorSession.js";
import type { MonitorSample } from "./MonitorSample.js";

function sample(index: number): MonitorSample {
    return {
        timestamp: `2026-01-01T00:00:0${index}.000Z`,
        hostCpuEnergyJoules: index,
        processCpuEnergyJoules: index,
        processCpuEnergyShare: 1,
        hostCpuCarbon_gCO2e: index,
        processCpuCarbon_gCO2e: index,
        isActive: index > 0,
    };
}

test("MonitorSession stores monitor samples", () => {
    const session = new MonitorSession({ capacity: 3 });

    session.push(sample(1));
    session.push(sample(2));

    assert.deepEqual(session.snapshot(), [
        sample(1),
        sample(2),
    ]);
});

test("MonitorSession keeps only the latest samples", () => {
    const session = new MonitorSession({ capacity: 2 });

    session.push(sample(1));
    session.push(sample(2));
    session.push(sample(3));

    assert.deepEqual(session.snapshot(), [
        sample(2),
        sample(3),
    ]);
});

test("MonitorSession can be cleared", () => {
    const session = new MonitorSession({ capacity: 2 });

    session.push(sample(1));
    session.clear();

    assert.deepEqual(session.snapshot(), []);
});