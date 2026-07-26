import process from "node:process";
import { readFile } from "node:fs/promises";
import { extractErrorCode, reasonFromCode } from "@carbontrace/shared";


interface ProcessCpuReaderOptions {
    log?: 'silent' | 'debug';
    pid?: number;
    statFilePath?: string;
}

interface ProcessCpuSample {
    ok: true;
    primed: boolean;
    pid: number;
    cpuTicks: {
        unit: "jiffies";
        deltaActive: bigint;
    };
}


interface ProcessStatSuccessSnapshot {
    ok: true;
    timeStamp: string;
    pid: number;
    comm: string;
    state: string;
    ppid: number;
    utime: bigint;
    stime: bigint;
    cutime: bigint;
    cstime: bigint;
    starttime: bigint;
}

interface ProcessStatErrorSnapshot {
    ok: false;
    error: string;
}

export type ProcessStatSnapshot =
    | ProcessStatSuccessSnapshot
    | ProcessStatErrorSnapshot;

interface ProcessCpuReaderState {
    last_app_ticks: bigint | null;//utime + stime at last tick
    last_start_time_ticks: bigint | null;//starttime of process at last tick
    primed: boolean;//fist read has been done
}

const STAT_FIELDS_NAME = [
    'pid', 'comm', 'state', 'ppid', 'pgrp', 'session', 'tty_nr', 'tpgid', 'flags',
    'minflt', 'cminflt', 'majflt', 'cmajflt', 'utime', 'stime', 'cutime', 'cstime',
    'priority', 'nice', 'num_threads', 'itrealvalue', 'starttime', 'vsize', 'rss',
    'rsslim', 'startcode', 'endcode', 'startstack', 'kstkesp', 'kstkeip', 'signal',
    'blocked', 'sigignore', 'sigcatch', 'wchan', 'nswap', 'cnswap', 'exit_signal',
    'processor', 'rt_priority', 'policy', 'delayacct_blkio_ticks', 'guest_time',
    'cguest_time', 'start_data', 'end_data', 'start_brk', 'arg_start', 'arg_end',
    'env_start', 'env_end', 'exit_code'
];

/** Erreur levée quand un champ requis de /proc/<pid>/stat est absent ou non entier. */
class MalformedStatError extends Error {
    constructor(message:string) {
        super(message);
        this.name = 'MalformedStatError';
    }
}
/**
 * Parse un compteur entier de /proc/<pid>/stat directement en bigint.
 * Les compteurs (jiffies, starttime) sont toujours des entiers : on évite
 * Number() qui perdrait la précision au-delà de 2^53 et produirait NaN sur
 * un champ absent (fichier tronqué quand le process meurt en cours de lecture).
 */
function parseStatBigInt(raw:string | undefined,field:string):bigint {
    if(raw === undefined || !/^-?\d+$/.test(raw)) {
        throw new MalformedStatError(`missing or non-integer field "${field}": ${raw}`);
    }
    return BigInt(raw);
}
/**
 * check if a PID is valid
 * must exclusively be a non-negative integer
 * must exclude pid 0 (system idle process) and process.pid (current process)
 * @param pid
 * @returns
 */
export function pidIsValid(pid: number): boolean {
    if (pid < 0 || !Number.isInteger(pid) || pid === 0) {
        return false;
    }
    return true;
}

export async function parsePidStatFile(statFilePath: string): Promise<ProcessStatSnapshot> {
    try {
        let statContent = await readFile(statFilePath, { encoding: 'utf-8' });
        const firstParen = statContent.indexOf('(');
        const lastParen = statContent.lastIndexOf(')');
        if (firstParen === -1 || lastParen === -1 || lastParen <= firstParen) {
            throw new Error(`Malformed stat file content: ${statContent}`);
        }

        statContent = statContent.trim();

        const pid = Number(statContent.slice(0, firstParen - 1).trim());
        const comm = statContent.slice(firstParen + 1, lastParen);
        const rest = statContent.slice(lastParen + 1).trim().split(/\s+/);

        const pidStat: Record<string, string | number | bigint | undefined> = {
            pid,
            comm
        };
        const values = rest;

        const state = values[0];
        if(state === undefined) {
            throw new MalformedStatError(`missing field "state`);
        }

        const ppidRaw = values[1];
        if(ppidRaw === undefined || !/^-?\d+$/.test(ppidRaw)) {
            throw new MalformedStatError(`missing or non-integer field "ppid": ${ppidRaw}`);
        }
        const snapshot: ProcessStatSnapshot = {
            ok: true,
            timeStamp: new Date().toISOString(),
            pid,
            comm,
            state,
            ppid: Number(ppidRaw),
            utime: parseStatBigInt(values[11], 'utime'),
            stime: parseStatBigInt(values[12], 'stime'),
            cutime: parseStatBigInt(values[13], 'cutime'),
            cstime: parseStatBigInt(values[14], 'cstime'),
            starttime: parseStatBigInt(values[19], 'starttime'),
        };

        return snapshot;
    } catch (error) {
        if(error instanceof MalformedStatError) {
            return { ok: false, error: 'malformed_stat'};
        }
        const code = extractErrorCode(error);

        return {
            ok: false,
            error: reasonFromCode(code),
        };
    }
}

export class ProcessCpuReader {
    log: 'silent' | 'debug';
    pid: number;
    statFilePath: string;
    state: ProcessCpuReaderState;

    constructor(options: ProcessCpuReaderOptions = {}) {
        this.log = options.log ?? 'silent';
        this.pid = options.pid ?? -1;
        if (!pidIsValid(this.pid)) {
            throw new Error(`Invalid PID: ${this.pid}`);
        }
        if (options.statFilePath) {
            const match = options.statFilePath.match(/\/proc\/(\d+)\/stat/);
            if (match) {
                const pidFromPath = Number(match[1]);
                if (pidFromPath !== this.pid) {
                    throw new Error(`PID from statFilePath (${pidFromPath}) does not match provided PID (${this.pid})`);
                }
            } else {
                throw new Error(`statFilePath does not match expected format: /proc/<pid>/stat`);
            }
        }
        this.statFilePath = options.statFilePath ?? `/proc/${this.pid}/stat`;

        this.state = {
            last_app_ticks: null,//utime + stime at last tick
            last_start_time_ticks: null,//starttime of process at last tick
            primed: false//fist read has been done
        }
    }

    static async probe(pid: number): Promise<{ ok: boolean; error?: string }> {
        const snapshot = await parsePidStatFile(`/proc/${pid}/stat`);

        if (snapshot.ok === false) {
            return {
                ok: false,
                error: snapshot.error,
            };
        }

        const DEAD_STATES = new Set(['Z', 'X', 'T']);

        if (DEAD_STATES.has(snapshot.state)) {
            return { ok: false, error: `process_dead (state: ${snapshot.state})` };
        }

        return { ok: true };
    }

    async sample(): Promise<ProcessCpuSample | { ok: false; error: string; }> {
        const pidStat = await parsePidStatFile(this.statFilePath);

    if (pidStat.ok === false) {
        return {
            ok: false,
            error: pidStat.error,
        };
    }

    const { pid, utime, stime, starttime } = pidStat;

    const current_app_ticks = utime + stime;
    const current_start_time_ticks = starttime;

        //first read/initialization
        if (!this.state.primed) {
            this.state.last_app_ticks = current_app_ticks;
            this.state.last_start_time_ticks = current_start_time_ticks;
            this.state.primed = true;
            return {
                ok: true,
                primed: false,
                pid,
                cpuTicks: { unit: "jiffies", deltaActive: 0n },
            }
        }

        //process restart detected
        if (this.state.last_start_time_ticks !== null && current_start_time_ticks !== this.state.last_start_time_ticks) {
            this.state.last_app_ticks = current_app_ticks;
            this.state.last_start_time_ticks = current_start_time_ticks;
            this.state.primed = false;
            //TODO log restart event?
            this.log === 'debug' && process.stdout.write(`ProcessCpuReader: Process restart detected for PID ${pid}\n`);
            return {
                ok: true,
                primed: false,
                pid,
                cpuTicks: { unit: "jiffies", deltaActive: 0n },
            }
        }

        let delta_active_ticks = current_app_ticks - (this.state.last_app_ticks ?? BigInt(0));

        if (delta_active_ticks < 0n) delta_active_ticks = 0n;

        this.state.last_app_ticks = current_app_ticks;

        return {
            ok: true,
            primed: this.state.primed,
            pid,
            cpuTicks: { unit: "jiffies", deltaActive: delta_active_ticks },
        };
    }
}