import type { ParsedMetrics } from "./types.js";

/**
 * Parses OpenTelemetry text exposition format into a flat metric map.
 *
 * Skips comment lines (starting with #) and blank lines. Each data line
 * is expected in the format: `metric_name value`.
 *
 * @param text - raw OTel text format string
 * @returns a record mapping metric names to their numeric values
 */
export function parseMetrics(text: string): ParsedMetrics {
  const result: ParsedMetrics = {};

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) {
      continue;
    }

    const name = trimmed.slice(0, spaceIdx);
    const value = Number(trimmed.slice(spaceIdx + 1));

    if (Number.isFinite(value)) {
      result[name] = value;
    }
  }

  return result;
}
