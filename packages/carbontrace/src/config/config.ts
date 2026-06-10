import { readFile } from "fs/promises";
import { extractErrorCode } from "@carbontrace/shared";

export interface AppConfig {
    emissionFactor?: {
        country: string;
        factor: number;
    },
    fallback?: {
        pidleWatts: number;
        pmaxWatts: number;
        tdpWatts: number;
        idleFraction: number;
        maxFraction: number;
    }
}


function isNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isAppConfig(value: unknown): value is AppConfig {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const config = value as Record<string, unknown>;

    if (config.emissionFactor !== undefined) {
        const ef = config.emissionFactor;

        if (typeof ef !== "object" || ef === null) {
            return false;
        }

        const record = ef as Record<string, unknown>;

        if (typeof record.country !== "string" || !isNumber(record.factor)) {
            return false;
        }
    }

    if (config.fallback !== undefined) {
        const fallback = config.fallback;

        if (typeof fallback !== "object" || fallback === null) {
            return false;
        }

        const record = fallback as Record<string, unknown>;

        if (
            !isNumber(record.pidleWatts) ||
            !isNumber(record.pmaxWatts) ||
            !isNumber(record.tdpWatts) ||
            !isNumber(record.idleFraction) ||
            !isNumber(record.maxFraction)
        ) {
            return false;
        }
    }

    return true;
}

export async function loadConfig(configPath: string,debug = false): Promise<AppConfig | undefined> {
    try {

        const raw = await readFile(configPath, 'utf-8');
        const parsed:unknown = JSON.parse(raw);

        if (typeof parsed !== "object" || parsed === null) {
            throw new Error("--config: invalid JSON object");
        }
        return parsed as AppConfig;

    } catch (error) {
        const code = extractErrorCode(error);
        if (code === 'ENOENT') {
            if (debug) {
                throw new Error(`[--config]: no such file ${configPath}`);
            }
            return undefined;
        }
        throw error;
    }
}