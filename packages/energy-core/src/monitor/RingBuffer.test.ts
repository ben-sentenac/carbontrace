import assert from "node:assert";
import test from "node:test";
import { RingBuffer } from "./RingBuffer";


test("RingBuffer returns latest value", () => {
    const buffer = new RingBuffer<number>(3);

    assert.equal(buffer.latest(), undefined);

    buffer.push(1);
    assert.equal(buffer.latest(), 1);

    buffer.push(2);
    assert.equal(buffer.latest(), 2);

    buffer.push(3);
    buffer.push(4);

    assert.equal(buffer.latest(), 4);
    assert.deepEqual(buffer.values(), [2, 3, 4]);
});