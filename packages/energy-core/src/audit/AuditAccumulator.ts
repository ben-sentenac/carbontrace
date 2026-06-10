// src/audit/AuditAccumulator.ts

export interface AccumulatorSample {
  hostCpuEnergyJoules?: number;
  hostCpuActiveTicks?: bigint;
  processCpuActiveTicks?: bigint;
}

export interface AccumulatorTotals {
  durationSeconds: number;
  hostCpuEnergyJoules: number;
  totalHostCpuActiveTicks: bigint;
  totalProcessCpuActiveTicks: bigint;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveBigInt(value: unknown): value is bigint {
  return typeof value === "bigint" && value > 0n;
}

export class AuditAccumulator {
  readonly startTimeNs: bigint;
  endTimeNs?: bigint;

  // accumulation brute
  private _hostCpuEnergyJoules = 0;
  private _totalHostCpuActiveTicks = 0n;
  private _totalProcessCpuActiveTicks = 0n;

  constructor(startTimeNs: bigint) {
    this.startTimeNs = startTimeNs;
  }

  /**
   * Alimente l’accumulateur avec les deltas d’un tick.
   * Toute valeur absente est ignorée.
   */
  push(sample: AccumulatorSample): void {
    if (isPositiveFiniteNumber(sample.hostCpuEnergyJoules)) {
      this._hostCpuEnergyJoules += sample.hostCpuEnergyJoules;
    }

    if (isPositiveBigInt(sample.hostCpuActiveTicks)) {
      this._totalHostCpuActiveTicks += sample.hostCpuActiveTicks;
    }

    if (isPositiveBigInt(sample.processCpuActiveTicks)) {
      this._totalProcessCpuActiveTicks += sample.processCpuActiveTicks;
    }
  }

  /**
   * Finalise l’audit et retourne les totaux agrégés.
   * Cette méthode doit être appelée UNE SEULE FOIS.
   */
  finalize(): AccumulatorTotals {
    const endNs =
      this.endTimeNs ?? process.hrtime.bigint();

    const durationSeconds =
      Number(endNs - this.startTimeNs) / 1e9;

    return {
      durationSeconds,
      hostCpuEnergyJoules: this._hostCpuEnergyJoules,
      totalHostCpuActiveTicks: this._totalHostCpuActiveTicks,
      totalProcessCpuActiveTicks:
        this._totalProcessCpuActiveTicks,
    };
  }
}
