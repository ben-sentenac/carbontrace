import assert from "node:assert/strict";
import test from "node:test";
import { aggregateProcessCpuSnapshots } from "./aggregateProcessCpuSnapshots.js";
import type { ProcessCpuSampleResult } from "./ProcessCpuGroupSnapshot.js";

test("aggregates alive process cpu samples", () => {
    const samples: ProcessCpuSampleResult[] = [
        {
            ok: true,
            primed: true,
            pid: 123,
            cpuTicks: {
                unit: "jiffies",
                deltaActive: 10n,
            },
        },
        {
            ok: true,
            primed: true,
            pid: 456,
            cpuTicks: {
                unit: "jiffies",
                deltaActive: 15n,
            },
        },
    ];

    const result = aggregateProcessCpuSnapshots(samples);

    assert.equal(result.ok, true);
    assert.equal(result.aliveProcesses, 2);
    assert.equal(result.deadProcesses, 0);
    assert.equal(result.primedProcesses, 2);
    assert.equal(result.totalDeltaActiveTicks, 25n);
});

test("ignores unprimed process cpu samples for total ticks", () => {
    const samples: ProcessCpuSampleResult[] = [
        {
            ok: true,
            primed: false,
            pid: 123,
            cpuTicks: {
                unit: "jiffies",
                deltaActive: 0n,
            },
        },
        {
            ok: true,
            primed: true,
            pid: 456,
            cpuTicks: {
                unit: "jiffies",
                deltaActive: 15n,
            },
        },
    ];

    const result = aggregateProcessCpuSnapshots(samples);

    assert.equal(result.aliveProcesses, 2);
    assert.equal(result.deadProcesses, 0);
    assert.equal(result.primedProcesses, 1);
    assert.equal(result.totalDeltaActiveTicks, 15n);
});

test("counts failed process cpu samples as dead processes", () => {
    const samples: ProcessCpuSampleResult[] = [
        {
            ok: true,
            primed: true,
            pid: 123,
            cpuTicks: {
                unit: "jiffies",
                deltaActive: 10n,
            },
        },
        {
            ok: false,
            error: "file_not_found",
        },
    ];

    const result = aggregateProcessCpuSnapshots(samples);

    assert.equal(result.aliveProcesses, 1);
    assert.equal(result.deadProcesses, 1);
    assert.equal(result.primedProcesses, 1);
    assert.equal(result.totalDeltaActiveTicks, 10n);
});