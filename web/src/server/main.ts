import { loadConfig } from "./config.js";
import { MetricsStore } from "./scraper/metrics_store.js";
import { MetricsScraper } from "./scraper/metrics_scraper.js";
import { createApp } from "./app.js";

/**
 * Entry point for the web server.
 *
 * Loads configuration, initializes the metrics store and scraper,
 * creates the Express app, and starts listening.
 */
function main(): void {
  const config = loadConfig();
  const store = new MetricsStore(config.retentionMs);
  const scraper = new MetricsScraper(config.targets, store, config.scrapeIntervalMs);
  const app = createApp(config, store, scraper);

  scraper.start();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Web server listening on port ${String(config.port)}`);
  });
}

main();
