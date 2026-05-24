import { describe, it, expect } from "vitest";
import { parseMetrics } from "./metrics_parser.js";

describe("parseMetrics", () => {
  it("parses OTel text format with HELP and TYPE comments", () => {
    const text = [
      "# HELP generator_requests_total Total requests sent",
      "# TYPE generator_requests_total counter",
      "generator_requests_total 1500",
      "# HELP generator_latency_p50_ms p50 latency in ms",
      "# TYPE generator_latency_p50_ms gauge",
      "generator_latency_p50_ms 12.5",
    ].join("\n");

    const result = parseMetrics(text);
    expect(result["generator_requests_total"]).toBe(1500);
    expect(result["generator_latency_p50_ms"]).toBe(12.5);
  });

  it("skips blank lines and comment-only lines", () => {
    const text = "\n# comment\n\ngenerator_rps_actual 100\n\n";
    const result = parseMetrics(text);
    expect(result["generator_rps_actual"]).toBe(100);
  });

  it("returns empty object for empty input", () => {
    expect(parseMetrics("")).toEqual({});
  });

  it("skips lines with non-numeric values", () => {
    const text = "metric_a abc\nmetric_b 42\n";
    const result = parseMetrics(text);
    expect(result["metric_b"]).toBe(42);
    expect(result["metric_a"]).toBeUndefined();
  });

  it("handles integer and float values", () => {
    const text = "counter 100\ngauge 3.14159\n";
    const result = parseMetrics(text);
    expect(result).toEqual({ counter: 100, gauge: 3.14159 });
  });
});
