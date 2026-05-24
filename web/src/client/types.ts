/** Parsed metric names mapped to their numeric values. */
export type ParsedMetrics = Record<string, number>;

/** A snapshot of metrics at a specific point in time. */
export interface TimestampedMetrics {
  timestamp: number;
  metrics: ParsedMetrics;
}

/** Time-series data for a single service. */
export interface ServiceTimeSeries {
  name: string;
  entries: TimestampedMetrics[];
}

/** Health and status information for a scraped service. */
export interface ServiceStatus {
  name: string;
  healthy: boolean;
  lastScrapeMs: number;
  error?: string;
}

/** Parameters for starting a simulation run. */
export interface SimulationParams {
  rps: number;
  duration: number;
  uri: string;
}

/** Result returned from a simulation run. */
export interface SimulationResult {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  rpsActual: number;
  elapsedMs: number;
  p50: number;
  p90: number;
  p99: number;
  p999: number;
  min: number;
  max: number;
  mean: number;
}
