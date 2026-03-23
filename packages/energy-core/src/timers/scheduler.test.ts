import assert from 'node:assert';
import { test, describe } from 'node:test';
import { fixedRateTicks } from './scheduler'; // Ajustez le chemin
import { setTimeout } from 'node:timers/promises';

describe('fixedRateTicks Generator', async () => {

    // --- TEST DES ERREURS D'ENTRÉE ---
    await test('Validation: must throw if periodMs is <= 0', async () => {
        // Note: use assert.rejectsbecause of asynchronous generator
        await assert.rejects(
            async () => {
                const gen = fixedRateTicks({ periodMs: -5 });
                await gen.next();
            },
            { message: /must be a positive number/ }
        );

        await assert.rejects(
            async () => {
                const gen = fixedRateTicks({ periodMs: 0 });
                await gen.next();
            },
            { message: /must be a positive number/ }
        );
    });

    // --- OK ---
    await test('OK: must generate ticks with good values', async () => {
        const periodMs = 10;
        const gen = fixedRateTicks({ periodMs });
        
        const { value: tick } = await gen.next();
        
        assert.strictEqual(tick.tickId, 0);
        assert.strictEqual(tick.scheduleIndex, 0n);
        assert.ok(tick.periodNs > 0n);
        assert.strictEqual(tick.skippedPeriods, 0n);
        
        // stop generator to avoid infinite loop in the test
        await gen.return(null); 
    });

    // --- "BURST" POLICY ---
    await test('Policy "burst": must not jump tick if late', async () => {
        const periodMs = 20;
        const gen = fixedRateTicks({ periodMs, overrunPolicy: 'burst' });

        // first tick (t0)
        await gen.next();

        // simulate burst in main threat
        const start = Date.now();
        while (Date.now() - start < 50) { /* busy wait */ }

        // second tick : even if late , index must be 1
        const { value: tick2 } = await gen.next();
        assert.strictEqual(tick2.scheduleIndex, 1n, "Burst must treat index 1 even if late");
        assert.ok(tick2.latenessNs > 0n, "tick must me marked late");

        await gen.return(null);
    });

    // --- "COALESCE" POLICY ---
    await test('Policy "coalesce": must jump tick if late', async () => {
        const periodMs = 10;
        const gen = fixedRateTicks({ periodMs, overrunPolicy: 'coalesce' });

        // Tick 0
        await gen.next();

        // waiting more than period
        await setTimeout(50); 

        // Tick 1 : must jump period to catch up the real time
        const { value: tick1 } = await gen.next();
        
        // if we wait 50ms on 10ms period, we jumped over index
        assert.ok(tick1.skippedPeriods > 0n, "Coalesce should jump period");
        
        await gen.return(null);
    });

    // --- TEST DE L'ABORT SIGNAL ---
    await test('Signal: must stop when abort signal is called', async () => {
        const controller = new AbortController();
        const gen = fixedRateTicks({ periodMs: 100, signal: controller.signal });

        // On lance le premier tick
        const promise = gen.next();
        
        // On avorte immédiatement
        controller.abort();
        
        const { done } = await promise;
        assert.strictEqual(done, true, "generator must be stopped");
    });
});