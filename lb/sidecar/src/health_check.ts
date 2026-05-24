/**
 * Interface for a modular health check that can detect server pauses
 * or other unhealthy states.
 *
 * Each health check is evaluated in the sidecar's main loop. ALL health
 * checks must pass for the server to be considered healthy.
 */
export interface HealthCheck {
  /**
   * Returns whether this health check considers the server healthy.
   * @returns True if the check passes, false if the server should be drained.
   */
  isHealthy(): boolean;

  /**
   * Returns the drain interval in milliseconds to request when this check fails.
   * @returns The drain duration in ms.
   */
  getDrainInterval(): number;
}
