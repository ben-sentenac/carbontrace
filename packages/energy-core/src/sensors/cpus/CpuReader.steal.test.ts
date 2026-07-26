import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCpuUtilization } from './CpuReader.js';

// steal = temps où l'hyperviseur a retiré le CPU à cette VM. Le process ne
// tourne pas pendant ce temps (il n'accumule ni utime ni stime), donc pour que
// le ratio process/machine soit cohérent, steal ne doit compter ni dans active
// ni dans total.
test('computeCpuUtilization - steal is excluded from active and total', () => {
    const base = {
        user: 100n, nice: 0n, system: 50n,
        idle: 200n, iowait: 0n,
        irq: 0n, softirq: 0n,
        steal: 0n,
    };

    const withoutSteal = computeCpuUtilization(base);
    const withSteal = computeCpuUtilization({ ...base, steal: 300n });

    // Ajouter du steal ne doit changer NI active NI total.
    assert.strictEqual(withSteal.active, withoutSteal.active,
        'steal must not inflate active');
    assert.strictEqual(withSteal.total, withoutSteal.total,
        'steal must not inflate total');

    // Valeurs attendues explicites : active = user+nice+system+irq+softirq = 150,
    // idle = idle+iowait = 200, total = 350. steal absent.
    assert.strictEqual(withSteal.active, 150n);
    assert.strictEqual(withSteal.idle, 200n);
    assert.strictEqual(withSteal.total, 350n);
});