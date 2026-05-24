import { EventEmitter } from "node:events";
import type { HealthCheck } from "./health_check.js";

const DEFAULT_CHECK_INTERVAL_MS = 1;

/**
 * Runs all registered health checks at high frequency and tracks the
 * aggregate health state of the server.
 *
 * Emits a `stateChange` event with a boolean argument whenever the
 * aggregate healthy/unhealthy state transitions.
 */
export class HealthCheckRunner extends EventEmitter {
  private readonly checks: readonly HealthCheck[];
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentHealthy: boolean = true;
  private currentDrainInterval: number = 0;

  /**
   * Creates a new HealthCheckRunner.
   * @param checks - The health checks to evaluate each iteration.
   * @param intervalMs - How often (in ms) to run the checks. Defaults to 1ms.
   */
  constructor(checks: readonly HealthCheck[], intervalMs: number = DEFAULT_CHECK_INTERVAL_MS) {
    super();
    this.checks = checks;
    this.intervalMs = intervalMs;
    this.currentDrainInterval = this.computeMaxDrainInterval();
  }

  /**
   * Whether all health checks currently pass.
   * @returns True if the server is healthy.
   */
  get healthy(): boolean {
    return this.currentHealthy;
  }

  /**
   * The maximum drain interval across all registered health checks.
   * @returns The drain interval in ms.
   */
  get drainInterval(): number {
    return this.currentDrainInterval;
  }

  /**
   * Starts the periodic health check loop.
   */
  start(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      this.runChecks();
    }, this.intervalMs);
  }

  /**
   * Stops the periodic health check loop.
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Evaluates all health checks and updates aggregate state.
   *
   * Emits `stateChange` when the healthy state transitions.
   */
  private runChecks(): void {
    let allHealthy = true;

    for (const check of this.checks) {
      if (!check.isHealthy()) {
        allHealthy = false;
        break;
      }
    }

    this.currentDrainInterval = this.computeMaxDrainInterval();

    if (allHealthy !== this.currentHealthy) {
      this.currentHealthy = allHealthy;
      this.emit("stateChange", allHealthy);
    }
  }

  /**
   * Computes the maximum drain interval across all health checks.
   * @returns The max drain interval in ms.
   */
  private computeMaxDrainInterval(): number {
    let max = 0;
    for (const check of this.checks) {
      const interval = check.getDrainInterval();
      if (interval > max) {
        max = interval;
      }
    }
    return max;
  }
}
