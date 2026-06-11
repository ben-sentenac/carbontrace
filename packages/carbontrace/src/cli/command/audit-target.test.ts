import assert from "node:assert";
import test from "node:test";

import { buildAuditTarget, formatAuditTarget } from "./audit-target";


test("buildAuditTarget creates a single process target for ons pid", () => {
    assert.deepEqual(buildAuditTarget([123]), {
        kind:"process",
        pid:123
    });
});

test("buildAuditTarget creates a process group target for multiple pids", () => {
    assert.deepEqual(buildAuditTarget([123, 456]), {
        kind: "process-group",
        pids: [123, 456],
    });
});

test("formatAuditTarget formats a single pid", () => {
    assert.equal(formatAuditTarget([123]), "PID:123");
});

test("formatAuditTarget formats multiple pids", () => {
    assert.equal(formatAuditTarget([123, 456]), "PIDs:123,456");
});