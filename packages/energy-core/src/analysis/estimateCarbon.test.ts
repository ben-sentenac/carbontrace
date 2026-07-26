import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCarbonFootprint } from './estimateCarbon.js';

test('estimateCarbonFootprint - nominal: 3.6e6 J = 1 kWh', () => {
    const r = estimateCarbonFootprint({ energyJoules: 3_600_000, emissionFactor: 50 });
    assert.strictEqual(r.ok, true);
    if (r.ok) {
        assert.strictEqual(r.energy_Kwh, 1);
        assert.strictEqual(r.carbon_gCO2e, 50);
    }
});

test('estimateCarbonFootprint - zero energy yields zero carbon', () => {
    const r = estimateCarbonFootprint({ energyJoules: 0, emissionFactor: 50 });
    assert.strictEqual(r.ok, true);
    if (r.ok) {
        assert.strictEqual(r.carbon_gCO2e, 0);
    }
});

test('estimateCarbonFootprint - negative energy is a typed error', () => {
    const r = estimateCarbonFootprint({ energyJoules: -5, emissionFactor: 50 });
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
        assert.strictEqual(r.reason, 'invalid_energy_joules');
    }
});

test('estimateCarbonFootprint - negative emission factor is a typed error', () => {
    const r = estimateCarbonFootprint({ energyJoules: 100, emissionFactor: -1 });
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
        assert.strictEqual(r.reason, 'invalid_emission_factor');
    }
});