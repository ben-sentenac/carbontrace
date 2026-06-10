import { CpuReader } from "../sensors/cpus/CpuReader.js";
import { ProcessCpuReader } from "../sensors/cpus/ProcessCpuReader.js";
import {
    createEnergyReader,
    type EnergyReader,
    type EnergyReaderFactoryOptions,
} from "../sensors/rapl/energyReader.js";
import { raplProbe } from "../sensors/rapl/rapl-probe.js";

import type { AuditTarget } from "../audit/AuditTarget.js";
import { normalizeTarget } from "../audit/normalizeTarget.js";

export interface Samplers {
    energyReader?: EnergyReader;
    cpuReader?: CpuReader;
    processCpuReader?: ProcessCpuReader;
    processCpuReaders?: ProcessCpuReader[];  // futur
};

export interface Samples {
    energy: Awaited<ReturnType<EnergyReader["sample"]>> | null;
    cpu: Awaited<ReturnType<CpuReader["sample"]>> | null;
    processCpu: Awaited<ReturnType<ProcessCpuReader["sample"]>> | null;
    processCpus?: Awaited<ReturnType<ProcessCpuReader["sample"]>>[];
}

type FallBackOptions = EnergyReaderFactoryOptions["fallback"];

function finiteNumberOrUndefined(value: number | undefined): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function createSamplers(target: AuditTarget, fallbackOptions: FallBackOptions): Promise<Samplers> {
    const pids = normalizeTarget(target);
    const pid = pids[0];

    if (pid === undefined) {
        throw new Error("sampler target must contain at least one pid");
    }

    const probe = await raplProbe();
    const fb = fallbackOptions;
    return {
        energyReader: createEnergyReader({
            probe,
            fallback: {
                tdpWatts: finiteNumberOrUndefined(fb?.tdpWatts),
                pidleWatts: finiteNumberOrUndefined(fb?.pidleWatts),
                pmaxWatts: finiteNumberOrUndefined(fb?.pmaxWatts),
            }
        }),
        cpuReader: new CpuReader({}),
        processCpuReader: new ProcessCpuReader({ pid }),
        processCpuReaders: pids.map(
            pid => new ProcessCpuReader({ pid })
        ),
    };
}

export async function collectSamples(samplers: Samplers, nowNs: bigint): Promise<Samples> {
    const { energyReader, cpuReader, processCpuReader,processCpuReaders } = samplers;
    const [energy, cpu, processCpu] = await Promise.all(
        [
            energyReader ? energyReader.sample(nowNs) : Promise.resolve(null),
            cpuReader ? cpuReader.sample(nowNs) : Promise.resolve(null),
            processCpuReader ? processCpuReader.sample() : Promise.resolve(null)

        ]
    );

    const processCpus = processCpuReaders
    ? await Promise.all(
        processCpuReaders.map((reader) => reader.sample())
      )
    : undefined;

    return { energy, cpu, processCpu, processCpus };
}