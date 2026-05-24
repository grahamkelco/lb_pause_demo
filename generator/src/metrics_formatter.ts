import type { MetricsSnapshot } from "./metrics.js";

/**
 * Formats a MetricsSnapshot into OpenTelemetry text exposition format.
 *
 * Produces counters for request counts and gauges for latency percentiles,
 * suitable for scraping by the web server's metrics collector.
 */
export function formatMetrics(snapshot: MetricsSnapshot): string {
  const lines: string[] = [];

  addCounter(lines, "generator_requests_total", "Total requests sent", snapshot.totalRequests);
  addCounter(lines, "generator_requests_success", "Successful requests", snapshot.successCount);
  addCounter(lines, "generator_requests_error", "Failed requests", snapshot.errorCount);

  addGauge(lines, "generator_rps_actual", "Actual achieved RPS", snapshot.rpsActual);
  addGauge(lines, "generator_duration_ms", "Test duration in milliseconds", snapshot.elapsedMs);

  addGauge(lines, "generator_latency_p50_ms", "p50 latency in ms", snapshot.p50);
  addGauge(lines, "generator_latency_p90_ms", "p90 latency in ms", snapshot.p90);
  addGauge(lines, "generator_latency_p99_ms", "p99 latency in ms", snapshot.p99);
  addGauge(lines, "generator_latency_p999_ms", "p99.9 latency in ms", snapshot.p999);
  addGauge(lines, "generator_latency_min_ms", "Min latency in ms", snapshot.min);
  addGauge(lines, "generator_latency_max_ms", "Max latency in ms", snapshot.max);
  addGauge(lines, "generator_latency_mean_ms", "Mean latency in ms", snapshot.mean);

  return lines.join("\n") + "\n";
}

/**
 * Appends a counter metric entry to the output lines.
 *
 * @param lines - the output line array
 * @param name - metric name
 * @param help - metric description
 * @param value - metric value
 */
function addCounter(lines: string[], name: string, help: string, value: number): void {
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} counter`);
  lines.push(`${name} ${value}`);
}

/**
 * Appends a gauge metric entry to the output lines.
 *
 * @param lines - the output line array
 * @param name - metric name
 * @param help - metric description
 * @param value - metric value
 */
function addGauge(lines: string[], name: string, help: string, value: number): void {
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} gauge`);
  lines.push(`${name} ${value}`);
}
