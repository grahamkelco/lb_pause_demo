import type { HealthCheck } from "./health_check.js";

const DEFAULT_DRAIN_INTERVAL_MS = 200;

/**
 * A dummy health check that always reports the server as healthy.
 *
 * Used for testing and as a baseline when no real pause detection
 * is configured.
 */
export class AlwaysHealthy implements HealthCheck {
  /**
   * Always returns true.
   * @returns True.
   */
  isHealthy(): boolean {
    return true;
  }

  /**
   * Returns the default drain interval.
   * @returns 200ms.
   */
  getDrainInterval(): number {
    return DEFAULT_DRAIN_INTERVAL_MS;
  }
}
