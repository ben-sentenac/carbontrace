import { CpuReader } from "../cpus/CpuReader.js";
import { RaplSample } from "./RaplReader.js";


// P_estimate_j = (P_idle + (P_max - p_idle) * load) * durationS

/**
 * Single source of truth for TDP-mode fraction defaults.
 *
 * idle=0.30: a package at idle typically draws 15-35% of TDP; 0.30 is a
 *            reasonable midpoint for a server-class part.
 * max=0.90:  sustained full-load package power sits a little below rated TDP.
 *
 * Coarse approximation only — measured --pidleW/--pmaxW is preferred.
 */

export const DEFAULT_IDLE_FRACTION = 0.3;
export const DEFAULT_MAX_FRACTION = 0.9;

export interface EmpiricalEnergyReaderOptions {
    //recomanded mode
    pidleWatts?: number;
    pmaxWatts?: number;

    //TDP mode
    tdpWatts?: number;
     /**
     * TDP-mode power model: P = (P_idle + (P_max - P_idle) * load), where
     *   P_idle = idleFraction * tdpWatts
     *   P_max  = maxFraction  * tdpWatts
     *
     * These fractions are a coarse approximation. A CPU package at idle still
     * draws a substantial share of TDP (static leakage, uncore, cache, memory
     * controller), so idleFraction well below ~0.15 is physically unrealistic
     * for a server. Prefer measured --pidleW/--pmaxW over TDP mode when accuracy
     * matters.
     */

    idleFraction?: number;//default DEFAULT_IDLE_FRACTION
    maxFraction?: number; //default: DEFAULT_MAX_FRACTION

    statFilePath?: string;

    log?: "silent" | "debug"
}


function isPositive(n: unknown): n is number {
    return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function clamp01(x: number) {
    if (!Number.isFinite(x)) return 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
}


export class EmpiricalEnergyReader {
    public readonly mode = 'fallback';
    public cpuReader: CpuReader;

    public isReady = true;
    public status: string | null = "FALLBACK_ESTIMATE";
    public hint: string | null = null;

    private pidleWatts?: number;
    private pmaxWatts?: number;

    private tdpWatts?: number;
    private idleFraction: number;
    private maxFraction: number;


    constructor(options: EmpiricalEnergyReaderOptions) {
        const {
            pidleWatts,
            pmaxWatts,
            tdpWatts,
            idleFraction = DEFAULT_IDLE_FRACTION,
            maxFraction = DEFAULT_MAX_FRACTION,
            statFilePath,
            log = "silent"
        } = options;

        this.pidleWatts = pidleWatts;
        this.pmaxWatts = pmaxWatts;

        this.tdpWatts = tdpWatts;
        this.idleFraction = idleFraction;
        this.maxFraction = maxFraction;

        const hasWatts = isPositive(pidleWatts) && isPositive(pmaxWatts);
        const hasTdp = isPositive(tdpWatts);

        if (hasWatts) {
            if (pmaxWatts < pidleWatts) {
                this.isReady = false;
                this.status = "INVALID_FALLBACK_WATTS";
                this.hint = "pmaxWatts must be >= pidleWatts";
            } else {
                this.hint = `empirical watts: P_idle=${pidleWatts}W P_max=${pmaxWatts}W`;
            }

        } else if (hasTdp) {
            this.hint = `empirical tdp: TDP=${tdpWatts}W (idle=${idleFraction}, max=${maxFraction})`;
        } else {
            this.isReady = false;
            this.status = "MISSING_FALLBACK_PARAMS";
            this.hint = "Provide --pidle-w/--pmax-w (recommended) or --tdp for fallback mode";
        }

        this.cpuReader = new CpuReader({
            statFilePath: statFilePath ?? '/proc/stat',
            log
        });
    }


    async sample(nowNs: bigint): Promise<RaplSample | null> {
        if (!this.isReady) return null;

        const cpuStat = await this.cpuReader.sample(nowNs);

        if (!cpuStat || cpuStat.ok === false) {
            return {
                ok: false,
                primed: false,
                internalClampedDt: 0,
                deltaJ: 0,
                deltaUj: 0,
                packages: [],
                wraps: 0,
                unhandledWraps:0,
                expectedPackages:0,
                readablePackages:0
            }
        }

        if (!cpuStat.primed) {
            return {
                ok: true,
                primed: false,
                internalClampedDt: 0,
                deltaJ: 0,
                deltaUj: 0,
                packages: [],
                wraps: 0,
                unhandledWraps:0,
                expectedPackages:0,
                readablePackages:0
            }
        }

        const cpuLoad = clamp01(cpuStat.cpuUtilization ?? 0);
        const dt = cpuStat.internalClampedDt;

        let pIdle: number;
        let pMax: number;

        if (isPositive(this.pidleWatts) && isPositive(this.pmaxWatts)) {
            pIdle = this.pidleWatts;
            pMax = this.pmaxWatts;
        } else {
            //tDP mode
            const tdp = this.tdpWatts ?? 0;
            pIdle = tdp * this.idleFraction;
            pMax = tdp * this.maxFraction;
        }

        const powerW = pIdle + (pMax - pIdle) * cpuLoad;
        const deltaJ = powerW * dt;
        const deltaUj = deltaJ * 1e6;

        return {
            ok: true,
            primed: true,
            internalClampedDt: dt,
            deltaUj,
            deltaJ,
            packages: [],
            wraps: 0,
            unhandledWraps:0,
            expectedPackages:0,
            readablePackages:0
        }
    }

}