import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { parsePidStatFile } from './ProcessCpuReader.js';

// Fabrique un faux /proc/<pid>/stat avec un contenu donné, renvoie son chemin.
async function writeStat(dir: string, content: string): Promise<string> {
    await mkdir(dir, { recursive: true });
    const p = path.join(dir, 'stat');
    await writeFile(p, content, 'utf8');
    return p;
}

// Cas A : fichier tronqué (le process est mort en cours de lecture).
// Les champs après comm manquent -> ne doit PAS throw, doit rapporter une
// erreur explicite, pas 'unknown'.
test('parsePidStatFile - truncated stat reports malformed_stat, does not throw', async () => {
    const dir = path.join(os.tmpdir(), `procstat-trunc-${process.pid}`);
    try {
        // "1234 (bash) R" puis plus rien : utime/stime/starttime absents.
        const statPath = await writeStat(dir, '1234 (bash) R');
        const snap = await parsePidStatFile(statPath);

        assert.strictEqual(snap.ok, false);
        if (snap.ok === false) {
            assert.strictEqual(snap.error, 'malformed_stat');
        }
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

// Cas B : un champ numérique requis n'est pas un nombre.
test('parsePidStatFile - non-numeric required field reports malformed_stat', async () => {
    const dir = path.join(os.tmpdir(), `procstat-nan-${process.pid}`);
    try {
        // On construit un stat avec utime = "xyz" (champ 14, donc index 11 après comm).
        // pid comm state ppid pgrp session tty_nr tpgid flags minflt cminflt majflt cmajflt utime ...
        const fields = ['R', '1', '1', '0', '0', '0', '0', '0', '0', '0', '0', 'xyz', '0', '0', '0'];
        const statPath = await writeStat(dir, `1234 (bash) ${fields.join(' ')}`);
        const snap = await parsePidStatFile(statPath);

        assert.strictEqual(snap.ok, false);
        if (snap.ok === false) {
            assert.strictEqual(snap.error, 'malformed_stat');
        }
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

// Cas C : starttime au-delà de 2^53 doit survivre sans perte de précision.
test('parsePidStatFile - large starttime preserved without precision loss', async () => {
    const dir = path.join(os.tmpdir(), `procstat-big-${process.pid}`);
    const bigStart = '9007199254740993'; // 2^53 + 1, non représentable en Number
    try {
        // On place des valeurs valides jusqu'à starttime (champ 22, index 19 après comm).
        // Indices après comm : 0=state 1=ppid ... 11=utime 12=stime 13=cutime 14=cstime
        // ... 19=starttime
        const after = [
            'R', '1', '0', '0', '0', '0', '0', '0', '0', '0', '0', // state..cmajflt (0..10)
            '100', '200', '0', '0',                                // utime stime cutime cstime (11..14)
            '0', '0', '0', '0',                                    // priority nice num_threads itrealvalue (15..18)
            bigStart,                                              // starttime (19)
        ];
        const statPath = await writeStat(dir, `1234 (bash) ${after.join(' ')}`);
        const snap = await parsePidStatFile(statPath);

        assert.strictEqual(snap.ok, true);
        if (snap.ok === true) {
            assert.strictEqual(snap.starttime, BigInt(bigStart));
            assert.strictEqual(snap.utime, 100n);
            assert.strictEqual(snap.stime, 200n);
        }
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});