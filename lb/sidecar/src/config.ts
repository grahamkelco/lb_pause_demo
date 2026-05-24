import { readFileSync } from "node:fs";
import yaml from "js-yaml";

const DEFAULT_CHECK_INTERVAL_MS = 1;
const DEFAULT_METRICS_PORT = 9100;

/**
 * Configuration for the sidecar process.
 */
export interface SidecarConfig {
  /** Hostname of the load balancer to connect to. */
  readonly lbHost: string;
  /** Sidecar TCP port on the load balancer. */
  readonly lbPort: number;
  /** How often (in ms) to run health checks. */
  readonly checkIntervalMs: number;
  /** Port for the sidecar's HTTP metrics endpoint. */
  readonly metricsPort: number;
  /** List of health check names to instantiate. */
  readonly healthChecks: readonly string[];
}

/**
 * Loads and validates sidecar configuration from a YAML file.
 * @param filePath - Path to the YAML config file.
 * @returns A validated SidecarConfig.
 */
export function loadSidecarConfig(filePath: string): SidecarConfig {
  const content = readFileSync(filePath, "utf-8");
  const raw = yaml.load(content) as Record<string, unknown> | undefined;

  if (raw == null || typeof raw !== "object") {
    throw new Error("Sidecar config file must contain a YAML mapping");
  }

  // Validate lb_host
  const lbHost = raw["lb_host"];
  if (typeof lbHost !== "string" || lbHost.length === 0) {
    throw new Error("lb_host must be a non-empty string");
  }

  // Validate lb_port
  const lbPort = raw["lb_port"];
  if (typeof lbPort !== "number" || !Number.isInteger(lbPort)) {
    throw new Error("lb_port must be an integer");
  }

  // Optional check_interval_ms
  const checkIntervalRaw = raw["check_interval_ms"];
  let checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
  if (checkIntervalRaw !== undefined) {
    if (typeof checkIntervalRaw !== "number" || !Number.isInteger(checkIntervalRaw)) {
      throw new Error("check_interval_ms must be an integer");
    }
    checkIntervalMs = checkIntervalRaw;
  }

  // Optional metrics_port
  const metricsPortRaw = raw["metrics_port"];
  let metricsPort = DEFAULT_METRICS_PORT;
  if (metricsPortRaw !== undefined) {
    if (typeof metricsPortRaw !== "number" || !Number.isInteger(metricsPortRaw)) {
      throw new Error("metrics_port must be an integer");
    }
    metricsPort = metricsPortRaw;
  }

  // Validate health_checks
  const healthChecksRaw = raw["health_checks"];
  if (!Array.isArray(healthChecksRaw) || healthChecksRaw.length === 0) {
    throw new Error("health_checks must be a non-empty array of strings");
  }
  for (let i = 0; i < healthChecksRaw.length; i++) {
    if (typeof healthChecksRaw[i] !== "string") {
      throw new Error(`health_checks[${i}] must be a string`);
    }
  }

  return {
    lbHost,
    lbPort,
    checkIntervalMs,
    metricsPort,
    healthChecks: healthChecksRaw as string[],
  };
}
