import test from "node:test";
import assert from "node:assert";
import { normalizeTarget } from "./normalizeTarget";

test("normalize single process", () => {
    assert.deepEqual(
        normalizeTarget({
            kind: "process",
            pid: 123
        }),
        [123]
    );
});

test("normalize process group", () => {
 assert.deepEqual(
        normalizeTarget({
            kind: "process-group",
            pids: [1, 2, 3]
        }),
        [1, 2, 3]
    );
});