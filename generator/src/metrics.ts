/**
 * Internal result type that pairs a snapshot with raw latency data.
 * Used for accurate percentile merging across workers.
 */
export interface MetricsResult {
  snapshot: MetricsSnapshot;
  latencies: number[];
}

/**
 * A snapshot of collected metrics at a point in time.
 */
export interface MetricsSnapshot {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  p50: number;
  p90: number;
  p99: number;
  p999: number;
  min: number;
  max: number;
  mean: number;
  rpsActual: number;
  elapsedMs: number;
}

/**
 * Collects per-request latency and success/error data for a load test run.
 * Each worker thread maintains its own Metrics instance.
 */
export class Metrics {
  private readonly latencies: number[] = [];
  private successCount = 0;
  private errorCount = 0;
  private startTime = 0;

  /**
   * Marks the start of metrics collection.
   */
  start(): void {
    this.startTime = performance.now();
  }

  /**
   * Records the result of a single request.
   *
   * @param latencyMs - request latency in milliseconds
   * @param success - whether the request succeeded
   */
  record(latencyMs: number, success: boolean): void {
    this.latencies.push(latencyMs);
    if (success) {
      this.successCount++;
    } else {
      this.errorCount++;
    }
  }

  /**
   * Produces a snapshot of the current metrics state.
   *
   * @returns a MetricsSnapshot with computed percentiles and summary stats
   */
  snapshot(): MetricsSnapshot {
    return this.result().snapshot;
  }

  /**
   * Produces a full result including the snapshot and raw latency data.
   * Use this when merging results across workers to get exact percentiles.
   *
   * @returns a MetricsResult with snapshot and raw latencies
   */
  result(): MetricsResult {
    const elapsedMs = performance.now() - this.startTime;
    const totalRequests = this.latencies.length;
    const latencies = [...this.latencies];

    if (totalRequests === 0) {
      return {
        snapshot: {
          totalRequests: 0, successCount: 0, errorCount: 0,
          p50: 0, p90: 0, p99: 0, p999: 0,
          min: 0, max: 0, mean: 0,
          rpsActual: 0, elapsedMs,
        },
        latencies,
      };
    }

    const sorted = latencies.sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);

    return {
      snapshot: {
        totalRequests,
        successCount: this.successCount,
        errorCount: this.errorCount,
        p50: percentile(sorted, 0.5),
        p90: percentile(sorted, 0.9),
        p99: percentile(sorted, 0.99),
        p999: percentile(sorted, 0.999),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        mean: sum / totalRequests,
        rpsActual: totalRequests / (elapsedMs / 1000),
        elapsedMs,
      },
      latencies: sorted,
    };
  }

  /**
   * Merges multiple MetricsResults into a single combined snapshot.
   * Concatenates raw latencies from all workers and recomputes exact percentiles.
   *
   * @param results - array of results from individual workers
   * @returns a single merged MetricsSnapshot
   */
  static merge(results: MetricsResult[]): MetricsSnapshot {
    if (results.length === 0) {
      return {
        totalRequests: 0, successCount: 0, errorCount: 0,
        p50: 0, p90: 0, p99: 0, p999: 0,
        min: 0, max: 0, mean: 0,
        rpsActual: 0, elapsedMs: 0,
      };
    }
    if (results.length === 1) {
      return results[0]!.snapshot;
    }

    let successCount = 0;
    let errorCount = 0;
    let maxElapsed = 0;
    const allLatencies: number[] = [];

    for (const r of results) {
      successCount += r.snapshot.successCount;
      errorCount += r.snapshot.errorCount;
      if (r.snapshot.elapsedMs > maxElapsed) maxElapsed = r.snapshot.elapsedMs;
      for (const l of r.latencies) {
        allLatencies.push(l);
      }
    }

    const sorted = allLatencies.sort((a, b) => a - b);
    const totalRequests = sorted.length;

    if (totalRequests === 0) {
      return {
        totalRequests: 0, successCount: 0, errorCount: 0,
        p50: 0, p90: 0, p99: 0, p999: 0,
        min: 0, max: 0, mean: 0,
        rpsActual: 0, elapsedMs: maxElapsed,
      };
    }

    const sum = sorted.reduce((acc, v) => acc + v, 0);

    return {
      totalRequests,
      successCount,
      errorCount,
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
      p99: percentile(sorted, 0.99),
      p999: percentile(sorted, 0.999),
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      mean: sum / totalRequests,
      rpsActual: maxElapsed > 0 ? totalRequests / (maxElapsed / 1000) : 0,
      elapsedMs: maxElapsed,
    };
  }
}

/**
 * Computes a percentile value from a sorted array of numbers.
 *
 * @param sorted - a sorted array of latency values
 * @param p - the percentile as a fraction (e.g. 0.99 for p99)
 * @returns the value at the given percentile
 */
function percentile(sorted: number[], p: number): number {
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

