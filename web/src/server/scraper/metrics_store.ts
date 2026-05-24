import type { ParsedMetrics, TimestampedMetrics, ServiceTimeSeries } from "./types.js";

/**
 * Rolling-window in-memory time-series store for scraped metrics.
 *
 * Automatically evicts entries older than the configured retention window
 * on every write.
 */
export class MetricsStore {
  private readonly data = new Map<string, TimestampedMetrics[]>();
  private readonly retentionMs: number;

  /**
   * Creates a new MetricsStore.
   *
   * @param retentionMs - how long to retain entries, in milliseconds
   */
  constructor(retentionMs: number) {
    this.retentionMs = retentionMs;
  }

  /**
   * Records a metrics snapshot for a service at the current time.
   *
   * @param serviceName - the name of the service
   * @param metrics - the parsed metric values
   * @param timestamp - optional timestamp override (defaults to Date.now())
   */
  record(serviceName: string, metrics: ParsedMetrics, timestamp?: number): void {
    const ts = timestamp ?? Date.now();
    const entry: TimestampedMetrics = { timestamp: ts, metrics };

    let entries = this.data.get(serviceName);
    if (!entries) {
      entries = [];
      this.data.set(serviceName, entries);
    }

    entries.push(entry);
    this.evict(entries, ts);
  }

  /**
   * Returns time-series data for all services.
   *
   * @returns an array of ServiceTimeSeries, one per service
   */
  getAll(): ServiceTimeSeries[] {
    const result: ServiceTimeSeries[] = [];
    for (const [name, entries] of this.data) {
      result.push({ name, entries: [...entries] });
    }
    return result;
  }

  /**
   * Returns time-series data for a single service.
   *
   * @param serviceName - the name of the service
   * @returns the service's time-series data, or undefined if not found
   */
  getService(serviceName: string): ServiceTimeSeries | undefined {
    const entries = this.data.get(serviceName);
    if (!entries) {
      return undefined;
    }
    return { name: serviceName, entries: [...entries] };
  }

  /**
   * Removes entries older than the retention window.
   *
   * @param entries - the entries array to evict from (mutated in place)
   * @param now - the current timestamp
   */
  private evict(entries: TimestampedMetrics[], now: number): void {
    const cutoff = now - this.retentionMs;
    while (entries.length > 0 && entries[0]!.timestamp < cutoff) {
      entries.shift();
    }
  }
}
