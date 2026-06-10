import fastify from "fastify";
import type { SharedMetricsSnapshot } from "./SharedMetrics.js";


const initialMetrics: SharedMetricsSnapshot = {
    status: "idle",
    updatedAt: null,
    samplesCount: 0,
    lastSample: null,
};


export async function buildServer(sharedMetrics: SharedMetricsSnapshot = initialMetrics) {
    const app = fastify({logger: true});

    app.get('/status', async (request, reply) => {
        return {
            status: 'OK',
            timestamp: new Date().toISOString(),
        };
    });

    app.get('/metrics', async (request, reply) => {
        return sharedMetrics;
    });

    return app;
}