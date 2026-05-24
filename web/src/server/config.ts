/**
 * Configuration types and environment-based loader for the web server.
 */

/** Describes a service endpoint to scrape metrics from. */
export interface ServiceTarget {
  /** Display name for the service */
  name: string;
  /** Hostname or IP */
  host: string;
  /** Port number */
  port: number;
  /** Path to the metrics endpoint */
  metricsPath: string;
}

/** Top-level server configuration. */
export interface ServerConfig {
  /** Port the web server listens on */
  port: number;
  /** How often to scrape targets, in milliseconds */
  scrapeIntervalMs: number;
  /** How long to keep time-series data, in milliseconds */
  retentionMs: number;
  /** List of service targets to scrape */
  targets: ServiceTarget[];
}

/** Default scrape interval: 2 seconds */
const DEFAULT_SCRAPE_INTERVAL_MS = 2000;

/** Default retention window: 5 minutes */
const DEFAULT_RETENTION_MS = 300_000;

/** Default web server port */
const DEFAULT_PORT = 3001;

/**
 * Loads server configuration from environment variables with sensible defaults.
 *
 * @returns a fully resolved ServerConfig
 */
export function loadConfig(): ServerConfig {
  const port = parseInt(process.env["WEB_PORT"] ?? String(DEFAULT_PORT), 10);
  const scrapeIntervalMs = parseInt(
    process.env["SCRAPE_INTERVAL_MS"] ?? String(DEFAULT_SCRAPE_INTERVAL_MS),
    10,
  );
  const retentionMs = parseInt(
    process.env["RETENTION_MS"] ?? String(DEFAULT_RETENTION_MS),
    10,
  );

  const generatorHost = process.env["GENERATOR_HOST"] ?? "localhost";
  const generatorPort = parseInt(process.env["GENERATOR_PORT"] ?? "8080", 10);

  const targets: ServiceTarget[] = [
    {
      name: "generator",
      host: generatorHost,
      port: generatorPort,
      metricsPath: "/metrics",
    },
  ];

  return { port, scrapeIntervalMs, retentionMs, targets };
}
