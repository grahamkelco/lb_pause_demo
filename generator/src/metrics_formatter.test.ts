import { describe, it, expect } from "vitest";
import { formatMetrics } from "./metrics_formatter.js";
import type { MetricsSnapshot } from "./metrics.js";

describe("formatMetrics", () => {
  it("produces valid OpenTelemetry text format", () => {
    const snapshot: MetricsSnapshot = {
      totalRequests: 100,
      successCount: 95,
      errorCount: 5,
      p50: 4.2,
      p90: 8.1,
      p99: 15.3,
      p999: 22.0,
      min: 1.0,
      max: 25.0,
      mean: 5.5,
      rpsActual: 98.5,
      elapsedMs: 1015,
    };

    const output = formatMetrics(snapshot);

    expect(output).toContain("# TYPE generator_requests_total counter");
    expect(output).toContain("generator_requests_total 100");
    expect(output).toContain("generator_requests_success 95");
    expect(output).toContain("generator_requests_error 5");
    expect(output).toContain("# TYPE generator_latency_p50_ms gauge");
    expect(output).toContain("generator_latency_p50_ms 4.2");
    expect(output).toContain("generator_latency_p99_ms 15.3");
    expect(output).toContain("generator_rps_actual 98.5");
    expect(output.endsWith("\n")).toBe(true);
  });
});
