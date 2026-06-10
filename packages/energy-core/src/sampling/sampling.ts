import { CpuReader } from "../sensors/cpus/CpuReader.js";
import { ProcessCpuReader } from "../sensors/cpus/ProcessCpuReader.js";
import {
    createEnergyReader,
    type EnergyReader,
    type EnergyReaderFactoryOptions,
} from "../sensors/rapl/energyReader.js";
import { raplProbe } from "../sensors/rapl/rapl-probe.js";

export interface Samplers {
    energyReader?: EnergyReader;
    cpuReader?: CpuReader;
    processCpuReader?: ProcessCpuReader;
};

export interface Samples {
    energy: Awaited<ReturnType<EnergyReader["sample"]>> | null;
    cpu: Awaited<ReturnType<CpuReader["sample"]>> | null;
    processCpu: Awaited<ReturnType<ProcessCpuReader["sample"]>> | null;
}

type FallBackOptions = EnergyReaderFactoryOptions["fallback"];

function finiteNumberOrUndefined(value: number | undefined): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function createSamplers(pid: number, fallbackOptions: FallBackOptions):Promise<Samplers> {
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
    };
}

export async function collectSamples(samplers: Samplers, nowNs: bigint): Promise<Samples> {
    const { energyReader, cpuReader, processCpuReader } = samplers;
    const [energy, cpu, processCpu] = await Promise.all(
        [
            energyReader ? energyReader.sample(nowNs) : Promise.resolve(null),
            cpuReader ? cpuReader.sample(nowNs) : Promise.resolve(null),
            processCpuReader ? processCpuReader.sample() : Promise.resolve(null)

        ]
    );

    return { energy, cpu, processCpu };
}