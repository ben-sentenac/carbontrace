import test from "node:test";
import assert from "node:assert/strict";
import { createMonitorTick } from "./createMonitorTick.js";

test("createMonitorTick computes process energy share and carbon", () => {
    const result = createMonitorTick({
        timestamp: "2026-01-01T00:00:00.000Z",
        hostCpuEnergyJoules: 100,
        totalHostCpuActiveTicks: 200n,
        totalProcessCpuActiveTicks: 50n,
        emissionFactor_gCO2ePerKWh: 3600,
    });

    assert.equal(result.sample.processCpuEnergyShare, 0.25);
    assert.equal(result.sample.processCpuEnergyJoules, 25);
    assert.equal(result.sample.hostCpuCarbon_gCO2e, 0.1);
    assert.equal(result.sample.processCpuCarbon_gCO2e, 0.025);
    assert.equal(result.sample.isActive, true);
});

test("createMonitorTick returns zero share when host cpu ticks are zero", () => {
    const result = createMonitorTick({
        timestamp: "2026-01-01T00:00:00.000Z",
        hostCpuEnergyJoules: 100,
        totalHostCpuActiveTicks: 0n,
        totalProcessCpuActiveTicks: 50n,
        emissionFactor_gCO2ePerKWh: 3600,
    });

    assert.equal(result.sample.processCpuEnergyShare, 0);
    assert.equal(result.sample.processCpuEnergyJoules, 0);
    assert.equal(result.sample.isActive, true);
});