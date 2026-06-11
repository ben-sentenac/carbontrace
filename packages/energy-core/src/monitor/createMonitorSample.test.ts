import test from "node:test";
import assert from "node:assert/strict";
import { createMonitorSample } from "./createMonitorSample.js";

test("createMonitorSample creates a monitor sample with carbon values", () => {
    const sample = createMonitorSample({
        timestamp: "2026-01-01T00:00:00.000Z",
        hostCpuEnergyJoules: 3_600_000,
        processCpuEnergyJoules: 1_800_000,
        processCpuEnergyShare: 0.5,
        emissionFactor_gCO2ePerKWh: 100,
        isActive: true,
    });

    assert.deepEqual(sample, {
        timestamp: "2026-01-01T00:00:00.000Z",
        hostCpuEnergyJoules: 3_600_000,
        processCpuEnergyJoules: 1_800_000,
        processCpuEnergyShare: 0.5,
        hostCpuCarbon_gCO2e: 100,
        processCpuCarbon_gCO2e: 50,
        isActive: true,
    });
});