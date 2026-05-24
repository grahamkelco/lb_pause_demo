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
    const elapsedMs = performance.now() - this.startTime;
    const totalRequests = this.latencies.length;

    if (totalRequests === 0) {
      return {
        totalRequests: 0, successCount: 0, errorCount: 0,
        p50: 0, p90: 0, p99: 0, p999: 0,
        min: 0, max: 0, mean: 0,
        rpsActual: 0, elapsedMs,
      };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);

    return {
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
    };
  }

  /**
   * Merges multiple MetricsSnapshots into a single combined snapshot.
   * Used to aggregate results from multiple worker threads.
   *
   * @param snapshots - array of snapshots from individual workers
   * @returns a single merged MetricsSnapshot
   */
  static merge(snapshots: MetricsSnapshot[]): MetricsSnapshot {
    if (snapshots.length === 0) {
      return {
        totalRequests: 0, successCount: 0, errorCount: 0,
        p50: 0, p90: 0, p99: 0, p999: 0,
        min: 0, max: 0, mean: 0,
        rpsActual: 0, elapsedMs: 0,
      };
    }
    if (snapshots.length === 1) {
      return snapshots[0]!;
    }

    let totalRequests = 0;
    let successCount = 0;
    let errorCount = 0;
    let maxElapsed = 0;
    let weightedMeanSum = 0;
    let globalMin = Infinity;
    let globalMax = -Infinity;

    for (const s of snapshots) {
      totalRequests += s.totalRequests;
      successCount += s.successCount;
      errorCount += s.errorCount;
      weightedMeanSum += s.mean * s.totalRequests;
      if (s.elapsedMs > maxElapsed) maxElapsed = s.elapsedMs;
      if (s.min < globalMin) globalMin = s.min;
      if (s.max > globalMax) globalMax = s.max;
    }

    // Without raw latencies we approximate percentiles using the max across workers.
    // This is a reasonable approximation for the demo.
    const mean = totalRequests > 0 ? weightedMeanSum / totalRequests : 0;

    return {
      totalRequests,
      successCount,
      errorCount,
      p50: approxPercentile(snapshots, "p50"),
      p90: approxPercentile(snapshots, "p90"),
      p99: approxPercentile(snapshots, "p99"),
      p999: approxPercentile(snapshots, "p999"),
      min: globalMin === Infinity ? 0 : globalMin,
      max: globalMax === -Infinity ? 0 : globalMax,
      mean,
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

/**
 * Approximates a merged percentile by taking the max of that percentile across snapshots.
 * This is a conservative (upper-bound) approximation suitable for a demo.
 *
 * @param snapshots - array of per-worker snapshots
 * @param key - the percentile key to approximate
 * @returns the approximated percentile value
 */
function approxPercentile(
  snapshots: MetricsSnapshot[],
  key: "p50" | "p90" | "p99" | "p999",
): number {
  let maxVal = 0;
  for (const s of snapshots) {
    if (s[key] > maxVal) maxVal = s[key];
  }
  return maxVal;
}
