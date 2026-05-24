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
  /** Load balancer target for admin API proxying */
  lbTarget: ServiceTarget;
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

  const lbHost = process.env["LB_HOST"] ?? "localhost";
  const lbPort = parseInt(process.env["LB_PORT"] ?? "8080", 10);

  const lbTarget: ServiceTarget = {
    name: "lb",
    host: lbHost,
    port: lbPort,
    metricsPath: "/metrics",
  };

  const targets: ServiceTarget[] = [
    {
      name: "generator",
      host: generatorHost,
      port: generatorPort,
      metricsPath: "/metrics",
    },
    { name: "sinkhole-1", host: "sinkhole-1", port: 8080, metricsPath: "/metrics" },
    { name: "sinkhole-2", host: "sinkhole-2", port: 8080, metricsPath: "/metrics" },
    { name: "sinkhole-3", host: "sinkhole-3", port: 8080, metricsPath: "/metrics" },
    { name: "sinkhole-4", host: "sinkhole-4", port: 8080, metricsPath: "/metrics" },
    { name: "sidecar-1", host: "sidecar-1", port: 9100, metricsPath: "/metrics" },
    { name: "sidecar-2", host: "sidecar-2", port: 9100, metricsPath: "/metrics" },
    { name: "sidecar-3", host: "sidecar-3", port: 9100, metricsPath: "/metrics" },
    { name: "sidecar-4", host: "sidecar-4", port: 9100, metricsPath: "/metrics" },
    { name: "sinkhole-random-1", host: "sinkhole-random-1", port: 8080, metricsPath: "/metrics" },
    { name: "sinkhole-random-2", host: "sinkhole-random-2", port: 8080, metricsPath: "/metrics" },
    { name: "sinkhole-random-3", host: "sinkhole-random-3", port: 8080, metricsPath: "/metrics" },
    { name: "sinkhole-random-4", host: "sinkhole-random-4", port: 8080, metricsPath: "/metrics" },
    { name: "sidecar-random-1", host: "sidecar-random-1", port: 9100, metricsPath: "/metrics" },
    { name: "sidecar-random-2", host: "sidecar-random-2", port: 9100, metricsPath: "/metrics" },
    { name: "sidecar-random-3", host: "sidecar-random-3", port: 9100, metricsPath: "/metrics" },
    { name: "sidecar-random-4", host: "sidecar-random-4", port: 9100, metricsPath: "/metrics" },
    { name: "simulated-pause-1", host: "simulated-pause-1", port: 8080, metricsPath: "/metrics" },
    { name: "simulated-pause-2", host: "simulated-pause-2", port: 8080, metricsPath: "/metrics" },
    { name: "simulated-pause-3", host: "simulated-pause-3", port: 8080, metricsPath: "/metrics" },
    { name: "simulated-pause-4", host: "simulated-pause-4", port: 8080, metricsPath: "/metrics" },
    { name: "sidecar-simulated-pause-1", host: "sidecar-simulated-pause-1", port: 9100, metricsPath: "/metrics" },
    { name: "sidecar-simulated-pause-2", host: "sidecar-simulated-pause-2", port: 9100, metricsPath: "/metrics" },
    { name: "sidecar-simulated-pause-3", host: "sidecar-simulated-pause-3", port: 9100, metricsPath: "/metrics" },
    { name: "sidecar-simulated-pause-4", host: "sidecar-simulated-pause-4", port: 9100, metricsPath: "/metrics" },
  ];

  return { port, scrapeIntervalMs, retentionMs, targets, lbTarget };
}
