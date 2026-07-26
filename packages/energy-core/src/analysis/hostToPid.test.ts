import test from 'node:test';
import assert from 'node:assert/strict';
import { attributeHostEnergyToPid } from './hostToPid.js';

test('attributeHostEnergyToPid - nominal: half the ticks gets half the energy', () => {
    const r = attributeHostEnergyToPid({
        hostEnergyJoules: 100,
        hostCpuActiveTicks: 200n,
        processCpuActiveTicks: 100n,
    });
    assert.strictEqual(r.ok, true);
    if (r.ok) {
        assert.strictEqual(r.cpuShare, 0.5);
        assert.strictEqual(r.processEnergyJoules, 50);
    }
});

test('attributeHostEnergyToPid - share is clamped to 1 when process exceeds host', () => {
    // Peut arriver sur bases de temps désalignées : le process ne doit jamais
    // se voir attribuer plus que 100% de l'énergie hôte.
    const r = attributeHostEnergyToPid({
        hostEnergyJoules: 100,
        hostCpuActiveTicks: 100n,
        processCpuActiveTicks: 150n,
    });
    assert.strictEqual(r.ok, true);
    if (r.ok) {
        assert.strictEqual(r.cpuShare, 1);
        assert.strictEqual(r.processEnergyJoules, 100);
    }
});

test('attributeHostEnergyToPid - no host activity is a typed error', () => {
    const r = attributeHostEnergyToPid({
        hostEnergyJoules: 100,
        hostCpuActiveTicks: 0n,
        processCpuActiveTicks: 0n,
    });
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
        assert.strictEqual(r.reason, 'no_host_cpu_activity');
    }
});

test('attributeHostEnergyToPid - negative host energy is a typed error', () => {
    const r = attributeHostEnergyToPid({
        hostEnergyJoules: -1,
        hostCpuActiveTicks: 200n,
        processCpuActiveTicks: 100n,
    });
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
        assert.strictEqual(r.reason, 'invalid_host_energy');
    }
});