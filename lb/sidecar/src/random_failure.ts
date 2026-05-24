import type { HealthCheck } from "./health_check.js";

const DEFAULT_MIN_HEALTHY_MS = 5000;
const DEFAULT_MAX_HEALTHY_MS = 15000;
const DEFAULT_MIN_FAILURE_MS = 1000;
const DEFAULT_MAX_FAILURE_MS = 10000;

/** Configuration options for {@link RandomFailure}. */
export interface RandomFailureConfig {
  readonly minHealthyMs?: number;
  readonly maxHealthyMs?: number;
  readonly minFailureMs?: number;
  readonly maxFailureMs?: number;
}

/**
 * A health check that simulates periodic server pauses with random timing.
 *
 * Alternates between healthy and unhealthy periods. Healthy periods last
 * between `minHealthyMs` and `maxHealthyMs`, while unhealthy periods last
 * between `minFailureMs` and `maxFailureMs`. Useful for testing the load
 * balancer's drain/failover behavior with the sinkhole server.
 */
export class RandomFailure implements HealthCheck {
  private readonly minHealthyMs: number;
  private readonly maxHealthyMs: number;
  private readonly minFailureMs: number;
  private readonly maxFailureMs: number;
  private currentlyHealthy: boolean = true;
  private nextTransitionTime: number;
  private currentFailureDuration: number = 0;

  /**
   * Creates a new RandomFailure health check.
   * @param config - Optional configuration for healthy/failure durations.
   */
  constructor(config?: RandomFailureConfig) {
    this.minHealthyMs = config?.minHealthyMs ?? DEFAULT_MIN_HEALTHY_MS;
    this.maxHealthyMs = config?.maxHealthyMs ?? DEFAULT_MAX_HEALTHY_MS;
    this.minFailureMs = config?.minFailureMs ?? DEFAULT_MIN_FAILURE_MS;
    this.maxFailureMs = config?.maxFailureMs ?? DEFAULT_MAX_FAILURE_MS;
    this.nextTransitionTime = Date.now() + this.randomBetween(this.minHealthyMs, this.maxHealthyMs);
  }

  /**
   * Returns whether the server is currently in a healthy period.
   *
   * Checks the current time against the next scheduled transition. When a
   * transition occurs, the state flips and a new random duration is computed.
   * @returns True if the check is in a healthy period, false otherwise.
   */
  isHealthy(): boolean {
    const now = Date.now();
    if (now >= this.nextTransitionTime) {
      this.currentlyHealthy = !this.currentlyHealthy;
      if (this.currentlyHealthy) {
        this.nextTransitionTime = now + this.randomBetween(this.minHealthyMs, this.maxHealthyMs);
        this.currentFailureDuration = 0;
      } else {
        this.currentFailureDuration = this.randomBetween(this.minFailureMs, this.maxFailureMs);
        this.nextTransitionTime = now + this.currentFailureDuration;
      }
    }
    return this.currentlyHealthy;
  }

  /**
   * Returns the drain interval matching the current failure duration.
   * @returns The current failure duration in ms, or `maxFailureMs` if healthy.
   */
  getDrainInterval(): number {
    return this.currentFailureDuration || this.maxFailureMs;
  }

  /**
   * Returns a random integer between min and max (inclusive).
   * @param min - The minimum value.
   * @param max - The maximum value.
   * @returns A random integer in [min, max].
   */
  private randomBetween(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
}
