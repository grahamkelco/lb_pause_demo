import type { ServiceTarget } from "../config.js";
import type { ServiceStatus } from "./types.js";
import { parseMetrics } from "./metrics_parser.js";
import { MetricsStore } from "./metrics_store.js";

/**
 * Periodically scrapes metrics from configured service targets
 * and stores them in a MetricsStore.
 */
export class MetricsScraper {
  private readonly targets: ServiceTarget[];
  private readonly store: MetricsStore;
  private readonly intervalMs: number;
  private readonly statuses = new Map<string, ServiceStatus>();
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates a new MetricsScraper.
   *
   * @param targets - the service endpoints to scrape
   * @param store - the metrics store to write results into
   * @param intervalMs - how often to scrape, in milliseconds
   */
  constructor(targets: ServiceTarget[], store: MetricsStore, intervalMs: number) {
    this.targets = targets;
    this.store = store;
    this.intervalMs = intervalMs;

    for (const target of targets) {
      this.statuses.set(target.name, {
        name: target.name,
        healthy: false,
        lastScrapeMs: 0,
      });
    }
  }

  /**
   * Starts the periodic scraping loop.
   */
  start(): void {
    if (this.timer) {
      return;
    }
    // Scrape immediately, then on interval
    void this.scrapeAll();
    this.timer = setInterval(() => {
      void this.scrapeAll();
    }, this.intervalMs);
  }

  /**
   * Stops the periodic scraping loop.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Returns the current health status of all targets.
   *
   * @returns an array of ServiceStatus objects
   */
  getStatuses(): ServiceStatus[] {
    return [...this.statuses.values()];
  }

  /**
   * Scrapes all configured targets in parallel.
   */
  private async scrapeAll(): Promise<void> {
    await Promise.all(this.targets.map((t) => this.scrapeTarget(t)));
  }

  /**
   * Scrapes a single target and records the result.
   *
   * @param target - the service target to scrape
   */
  private async scrapeTarget(target: ServiceTarget): Promise<void> {
    const url = `http://${target.host}:${String(target.port)}${target.metricsPath}`;
    const start = Date.now();

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (response.status === 204) {
        // No metrics available yet
        this.statuses.set(target.name, {
          name: target.name,
          healthy: true,
          lastScrapeMs: Date.now() - start,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`);
      }

      const text = await response.text();
      const metrics = parseMetrics(text);
      this.store.record(target.name, metrics);

      this.statuses.set(target.name, {
        name: target.name,
        healthy: true,
        lastScrapeMs: Date.now() - start,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.statuses.set(target.name, {
        name: target.name,
        healthy: false,
        lastScrapeMs: Date.now() - start,
        error: message,
      });
    }
  }
}
