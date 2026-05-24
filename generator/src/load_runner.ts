import { Metrics, type MetricsResult } from "./metrics.js";
import { RateLimiter } from "./rate_limiter.js";

/**
 * Configuration for a single-threaded load runner.
 */
export interface RunnerConfig {
  /** Requests per second this runner should generate */
  rps: number;
  /** Duration in seconds */
  durationSec: number;
  /** Target URI */
  uri: string;
}

/**
 * Executes a load test on a single thread by sending HTTP GET requests
 * at a fixed rate and collecting latency metrics.
 *
 * Requests are fired in a fire-and-forget manner to maintain the target
 * RPS regardless of server response time.
 */
export class LoadRunner {
  private readonly config: RunnerConfig;

  /**
   * Creates a new LoadRunner.
   *
   * @param config - runner configuration (rps, duration, uri)
   */
  constructor(config: RunnerConfig) {
    this.config = config;
  }

  /**
   * Runs the load test and returns collected metrics.
   * Requests are dispatched at the target rate without waiting for responses.
   * After all requests are dispatched, waits for in-flight responses to complete.
   *
   * @param sharedMetrics - optional external Metrics instance for live progress reporting
   * @param onStart - optional callback invoked once metrics.start() has been called
   * @returns a MetricsResult with snapshot and raw latencies
   */
  async run(sharedMetrics?: Metrics, onStart?: () => void): Promise<MetricsResult> {
    const { rps, durationSec, uri } = this.config;
    const metrics = sharedMetrics ?? new Metrics();
    const inFlight: Promise<void>[] = [];

    metrics.start();
    onStart?.();
    const limiter = new RateLimiter(rps, durationSec);

    await limiter.start(() => {
      const promise = this.sendRequest(uri, metrics);
      inFlight.push(promise);
    });

    // Wait for all in-flight requests to complete
    await Promise.allSettled(inFlight);

    return metrics.result();
  }

  /**
   * Sends a single GET request and records the result in metrics.
   *
   * @param uri - the target URI
   * @param metrics - the metrics collector
   */
  private async sendRequest(uri: string, metrics: Metrics): Promise<void> {
    const start = performance.now();
    try {
      const response = await fetch(uri);
      const latency = performance.now() - start;
      metrics.record(latency, response.ok);
    } catch {
      const latency = performance.now() - start;
      metrics.record(latency, false);
    }
  }
}
