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
  const generatorPort = parseInt(process.env["GENERATOR_PORT"] ?? "8081", 10);

  const lbHost = process.env["LB_HOST"] ?? "localhost";
  const lbPort = parseInt(process.env["LB_PORT"] ?? "8080", 10);

  const h = "127.0.0.1";

  const lbTarget: ServiceTarget = {
    name: "lb",
    host: lbHost,
    port: lbPort,
    metricsPath: "/metrics",
  };

  const targets: ServiceTarget[] = [
    { name: "generator", host: generatorHost, port: generatorPort, metricsPath: "/metrics" },
    { name: "sinkhole-1", host: h, port: 8001, metricsPath: "/metrics" },
    { name: "sinkhole-2", host: h, port: 8002, metricsPath: "/metrics" },
    { name: "sinkhole-3", host: h, port: 8003, metricsPath: "/metrics" },
    { name: "sinkhole-4", host: h, port: 8004, metricsPath: "/metrics" },
    { name: "sidecar-1", host: h, port: 9101, metricsPath: "/metrics" },
    { name: "sidecar-2", host: h, port: 9102, metricsPath: "/metrics" },
    { name: "sidecar-3", host: h, port: 9103, metricsPath: "/metrics" },
    { name: "sidecar-4", host: h, port: 9104, metricsPath: "/metrics" },
    { name: "sinkhole-random-1", host: h, port: 8005, metricsPath: "/metrics" },
    { name: "sinkhole-random-2", host: h, port: 8006, metricsPath: "/metrics" },
    { name: "sinkhole-random-3", host: h, port: 8007, metricsPath: "/metrics" },
    { name: "sinkhole-random-4", host: h, port: 8008, metricsPath: "/metrics" },
    { name: "sidecar-random-1", host: h, port: 9105, metricsPath: "/metrics" },
    { name: "sidecar-random-2", host: h, port: 9106, metricsPath: "/metrics" },
    { name: "sidecar-random-3", host: h, port: 9107, metricsPath: "/metrics" },
    { name: "sidecar-random-4", host: h, port: 9108, metricsPath: "/metrics" },
    { name: "simulated-pause-1", host: h, port: 8009, metricsPath: "/metrics" },
    { name: "simulated-pause-2", host: h, port: 8010, metricsPath: "/metrics" },
    { name: "simulated-pause-3", host: h, port: 8011, metricsPath: "/metrics" },
    { name: "simulated-pause-4", host: h, port: 8012, metricsPath: "/metrics" },
    { name: "sidecar-simulated-pause-1", host: h, port: 9109, metricsPath: "/metrics" },
    { name: "sidecar-simulated-pause-2", host: h, port: 9110, metricsPath: "/metrics" },
    { name: "sidecar-simulated-pause-3", host: h, port: 9111, metricsPath: "/metrics" },
    { name: "sidecar-simulated-pause-4", host: h, port: 9112, metricsPath: "/metrics" },
    { name: "java-gc-1", host: h, port: 8013, metricsPath: "/metrics" },
    { name: "java-gc-2", host: h, port: 8014, metricsPath: "/metrics" },
    { name: "java-gc-3", host: h, port: 8015, metricsPath: "/metrics" },
    { name: "java-gc-4", host: h, port: 8016, metricsPath: "/metrics" },
    { name: "sidecar-java-gc-1", host: h, port: 9113, metricsPath: "/metrics" },
    { name: "sidecar-java-gc-2", host: h, port: 9114, metricsPath: "/metrics" },
    { name: "sidecar-java-gc-3", host: h, port: 9115, metricsPath: "/metrics" },
    { name: "sidecar-java-gc-4", host: h, port: 9116, metricsPath: "/metrics" },
  ];

  return { port, scrapeIntervalMs, retentionMs, targets, lbTarget };
}
