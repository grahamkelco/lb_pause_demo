import { setTimeout } from "node:timers/promises";

/**
 * A callback invoked for each scheduled request.
 */
export type TickCallback = () => void;

/**
 * Drift-compensating rate limiter that fires a callback at a precise rate.
 *
 * Uses absolute-time scheduling rather than relative intervals to eliminate
 * cumulative drift. Each tick is anchored to startTime + (index * interval),
 * so temporary delays do not compound.
 */
export class RateLimiter {
  private readonly totalRequests: number;
  private readonly intervalMs: number;
  private cancelled = false;

  /**
   * Creates a new RateLimiter.
   *
   * @param rps - target requests per second
   * @param durationSec - how long to run in seconds
   */
  constructor(rps: number, durationSec: number) {
    this.totalRequests = rps * durationSec;
    this.intervalMs = 1000 / rps;
  }

  /**
   * Starts firing the callback at the configured rate.
   * Resolves when all requests have been dispatched or stop() is called.
   *
   * @param callback - function to invoke for each scheduled tick
   */
  async start(callback: TickCallback): Promise<void> {
    const startTime = performance.now();

    for (let i = 0; i < this.totalRequests; i++) {
      if (this.cancelled) break;

      callback();

      // Skip the delay after the last request
      if (i < this.totalRequests - 1) {
        const nextTime = startTime + (i + 1) * this.intervalMs;
        const delay = nextTime - performance.now();
        if (delay > 0) {
          await setTimeout(delay);
        }
      }
    }
  }

  /**
   * Cancels the rate limiter, stopping further callbacks.
   */
  stop(): void {
    this.cancelled = true;
  }
}
