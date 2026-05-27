import type { HealthCheck } from "./health_check.js";

const DEFAULT_DRAIN_INTERVAL_MS = 2000;
const DEFAULT_UNHEALTHY_CHANCE = 0.3;
const DEFAULT_MIN_STATE_DURATION_MS = 3000;

/**
 * A health check that randomly toggles between healthy and unhealthy states,
 * simulating unpredictable server pauses (e.g., GC stops).
 *
 * Stays in each state for at least `minStateDurationMs` before allowing
 * a transition, so drain/resume events are visible on dashboards.
 */
export class RandomHealthCheck implements HealthCheck {
  private readonly unhealthyChance: number;
  private readonly drainIntervalMs: number;
  private readonly minStateDurationMs: number;
  private healthy = true;
  private lastTransitionTime = Date.now();

  /**
   * Creates a new RandomHealthCheck.
   * @param unhealthyChance - Probability (0–1) of transitioning to unhealthy on each check.
   * @param drainIntervalMs - Drain interval to request when unhealthy.
   * @param minStateDurationMs - Minimum time to stay in a state before transitioning.
   */
  constructor(
    unhealthyChance: number = DEFAULT_UNHEALTHY_CHANCE,
    drainIntervalMs: number = DEFAULT_DRAIN_INTERVAL_MS,
    minStateDurationMs: number = DEFAULT_MIN_STATE_DURATION_MS,
  ) {
    this.unhealthyChance = unhealthyChance;
    this.drainIntervalMs = drainIntervalMs;
    this.minStateDurationMs = minStateDurationMs;
  }

  /**
   * Returns whether the server is currently considered healthy.
   * Randomly toggles state when the minimum duration has elapsed.
   * @returns True if healthy.
   */
  isHealthy(): boolean {
    const elapsed = Date.now() - this.lastTransitionTime;
    if (elapsed >= this.minStateDurationMs) {
      if (this.healthy && Math.random() < this.unhealthyChance) {
        this.healthy = false;
        this.lastTransitionTime = Date.now();
      } else if (!this.healthy) {
        // Always recover after min duration
        this.healthy = true;
        this.lastTransitionTime = Date.now();
      }
    }
    return this.healthy;
  }

  /**
   * Returns the drain interval when unhealthy.
   * @returns The drain interval in ms.
   */
  getDrainInterval(): number {
    return this.drainIntervalMs;
  }
}
