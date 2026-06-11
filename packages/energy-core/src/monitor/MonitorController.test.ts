import test from "node:test";
import assert from "node:assert/strict";
import { MonitorController } from "./MonitorController.js";
import { MonitorSession } from "./MonitorSession.js";
import type { Samplers } from "../sampling/sampling.js";

function createSamplers(): Samplers {
    return {
        energyReader: undefined,
        cpuReader: undefined,
        processCpuReaders: [],
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

test("MonitorController starts and stops", async () => {
    const session = new MonitorSession({ capacity: 10 });

    const controller = new MonitorController({
        session,
        samplers: createSamplers(),
        tickMs: 10,
        emissionFactor_gCO2ePerKWh: 52,
    });

    const promise = controller.start();

    assert.equal(controller.isRunning, true);

    controller.stop();

    await promise;

    assert.equal(controller.isRunning, false);
});

test("MonitorController collects samples into the session", async () => {
    const session = new MonitorSession({ capacity: 10 });
    const abortController = new AbortController();

    const controller = new MonitorController({
        session,
        samplers: createSamplers(),
        tickMs: 10,
        emissionFactor_gCO2ePerKWh: 52,
        signal: abortController.signal,
    });

    const promise = controller.start();

    await sleep(35);

    abortController.abort();

    await promise;

    assert.ok(session.size > 0);
    assert.equal(controller.isRunning, false);
});