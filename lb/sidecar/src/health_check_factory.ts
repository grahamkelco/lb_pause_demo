import type { HealthCheck } from "./health_check.js";
import { AlwaysHealthy } from "./always_healthy.js";
import { GcPauseCheck } from "./gc_pause_check.js";
import { RandomFailure } from "./random_failure.js";

/**
 * Creates health check instances from a list of string names.
 *
 * This factory is the single registration point for all available health
 * check types. Add new entries here as new checks are implemented.
 *
 * @param names - The health check names to instantiate (e.g. ["always_healthy"]).
 * @returns An array of HealthCheck instances.
 */
export function createHealthChecks(names: readonly string[]): HealthCheck[] {
  return names.map((name) => {
    switch (name) {
      case "always_healthy":
        return new AlwaysHealthy();
      case "random_failure":
        return new RandomFailure();
      case "gc_pause":
        return new GcPauseCheck();
      default:
        throw new Error(`Unknown health check: "${name}"`);
    }
  });
}
