import { cpus } from "node:os";

/**
 * Configuration for a load test run.
 */
export interface LoadTestConfig {
  /** Target requests per second */
  rps: number;
  /** Test duration in seconds */
  durationSec: number;
  /** Target URI to send GET requests to */
  uri: string;
  /** Number of worker threads to use */
  threads: number;
}

/**
 * Raw input values before validation and defaults are applied.
 */
export interface RawConfig {
  rps?: string | number;
  duration?: string | number;
  uri?: string;
  threads?: string | number;
}

/** Minimum allowed RPS */
const MIN_RPS = 1;

/** Maximum allowed RPS */
const MAX_RPS = 100_000;

/** Maximum allowed duration in seconds */
const MAX_DURATION_SEC = 3600;

/** RPS threshold per thread for auto-calculation */
const RPS_PER_THREAD = 500;

/**
 * Determines the optimal thread count based on CPU count and target RPS.
 *
 * @param rps - target requests per second
 * @returns the computed thread count
 */
function autoThreads(rps: number): number {
  const cpuCount = cpus().length;
  return Math.max(1, Math.min(cpuCount, Math.ceil(rps / RPS_PER_THREAD)));
}

/**
 * Validates raw inputs and produces a fully resolved LoadTestConfig.
 *
 * @param raw - raw configuration values (strings or numbers)
 * @returns a validated LoadTestConfig
 * @throws Error if required fields are missing or values are out of range
 */
export function parseConfig(raw: RawConfig): LoadTestConfig {
  if (raw.rps === undefined) {
    throw new Error("rps is required");
  }
  if (raw.duration === undefined) {
    throw new Error("duration is required");
  }
  if (!raw.uri) {
    throw new Error("uri is required");
  }

  const rps = Number(raw.rps);
  const durationSec = Number(raw.duration);

  if (!Number.isFinite(rps) || rps < MIN_RPS || rps > MAX_RPS) {
    throw new Error(`rps must be between ${MIN_RPS} and ${MAX_RPS}`);
  }
  if (!Number.isFinite(durationSec) || durationSec < 1 || durationSec > MAX_DURATION_SEC) {
    throw new Error(`duration must be between 1 and ${MAX_DURATION_SEC} seconds`);
  }

  let uri: string;
  try {
    uri = new URL(raw.uri).toString();
  } catch {
    throw new Error(`Invalid URI: ${raw.uri}`);
  }

  const threads = raw.threads !== undefined
    ? Number(raw.threads)
    : autoThreads(rps);

  if (!Number.isInteger(threads) || threads < 1) {
    throw new Error("threads must be a positive integer");
  }

  return { rps, durationSec, uri, threads };
}

/**
 * Parses a LoadTestConfig from URL query parameters.
 *
 * @param params - URLSearchParams from the incoming request
 * @returns a validated LoadTestConfig
 */
export function configFromQueryParams(params: URLSearchParams): LoadTestConfig {
  return parseConfig({
    rps: params.get("rps") ?? undefined,
    duration: params.get("duration") ?? undefined,
    uri: params.get("uri") ?? undefined,
    threads: params.get("threads") ?? undefined,
  });
}
