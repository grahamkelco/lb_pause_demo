import { readFileSync } from "node:fs";
import yaml from "js-yaml";

/**
 * Configuration for a single downstream server target.
 */
export interface ServerConfig {
  /** Hostname or IP of the downstream server. */
  readonly host: string;
  /** HTTP port of the downstream server. */
  readonly port: number;
  /** Optional sidecar port for future pause detection. */
  readonly sidecarPort?: number;
}

/**
 * Listen configuration for the load balancer.
 */
export interface ListenConfig {
  /** Port the load balancer listens on. */
  readonly port: number;
}

/**
 * Root configuration object parsed from the YAML config file.
 */
export interface LbConfig {
  /** Listen settings for the load balancer. */
  readonly listen: ListenConfig;
  /** List of downstream servers to route traffic to. */
  readonly servers: readonly ServerConfig[];
}

/**
 * Raw YAML shape before validation and camelCase mapping.
 */
interface RawServerEntry {
  host?: unknown;
  port?: unknown;
  /* eslint-disable @typescript-eslint/naming-convention */
  sidecar_port?: unknown;
  /* eslint-enable @typescript-eslint/naming-convention */
}

/**
 * Validates and maps a raw YAML server entry to a typed ServerConfig.
 * @param raw - The raw parsed object from YAML.
 * @param index - The index in the servers array, used for error messages.
 * @returns A validated ServerConfig.
 */
function parseServerEntry(raw: RawServerEntry, index: number): ServerConfig {
  if (typeof raw.host !== "string" || raw.host.length === 0) {
    throw new Error(`servers[${index}].host must be a non-empty string`);
  }
  if (typeof raw.port !== "number" || !Number.isInteger(raw.port)) {
    throw new Error(`servers[${index}].port must be an integer`);
  }

  const config: ServerConfig = { host: raw.host, port: raw.port };

  if (raw.sidecar_port !== undefined) {
    if (typeof raw.sidecar_port !== "number" || !Number.isInteger(raw.sidecar_port)) {
      throw new Error(`servers[${index}].sidecar_port must be an integer`);
    }
    return { ...config, sidecarPort: raw.sidecar_port };
  }

  return config;
}

/**
 * Loads and validates a load balancer configuration from a YAML file.
 * @param filePath - Absolute or relative path to the YAML config file.
 * @returns A validated LbConfig object.
 */
export function loadConfig(filePath: string): LbConfig {
  const content = readFileSync(filePath, "utf-8");
  const raw = yaml.load(content) as Record<string, unknown> | undefined;

  if (raw == null || typeof raw !== "object") {
    throw new Error("Config file must contain a YAML mapping");
  }

  // Validate listen section
  const listenRaw = raw["listen"] as Record<string, unknown> | undefined;
  if (listenRaw == null || typeof listenRaw !== "object") {
    throw new Error("Config must contain a 'listen' section");
  }
  if (typeof listenRaw["port"] !== "number" || !Number.isInteger(listenRaw["port"])) {
    throw new Error("listen.port must be an integer");
  }
  const listen: ListenConfig = { port: listenRaw["port"] };

  // Validate servers section
  const serversRaw = raw["servers"];
  if (!Array.isArray(serversRaw) || serversRaw.length === 0) {
    throw new Error("Config must contain a non-empty 'servers' array");
  }

  const servers = serversRaw.map(
    (entry: RawServerEntry, i: number) => parseServerEntry(entry, i),
  );

  return { listen, servers };
}
