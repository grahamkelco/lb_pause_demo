/** Parsed metric names mapped to their numeric values. */
export type ParsedMetrics = Record<string, number>;

/** A snapshot of metrics at a specific point in time. */
export interface TimestampedMetrics {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** The parsed metric values */
  metrics: ParsedMetrics;
}

/** Time-series data for a single service. */
export interface ServiceTimeSeries {
  /** Service display name */
  name: string;
  /** Ordered list of timestamped metric entries */
  entries: TimestampedMetrics[];
}

/** Health and status information for a scraped service. */
export interface ServiceStatus {
  /** Service display name */
  name: string;
  /** Whether the last scrape succeeded */
  healthy: boolean;
  /** Duration of the last scrape in milliseconds */
  lastScrapeMs: number;
  /** Error message from the last failed scrape, if any */
  error?: string;
}
