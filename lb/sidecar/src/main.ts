import { loadSidecarConfig, loadSidecarConfigFromEnv } from "./config.js";
import { createHealthChecks } from "./health_check_factory.js";
import { Sidecar } from "./sidecar.js";

const DEFAULT_CONFIG_PATH = "./sidecar_config.yaml";

/**
 * Resolves the config file path from CLI args, environment, or default.
 * @returns The resolved config file path.
 */
function resolveConfigPath(): string {
  return process.argv[2]
    ?? process.env["SIDECAR_CONFIG_PATH"]
    ?? DEFAULT_CONFIG_PATH;
}

/**
 * Main entry point for the sidecar process.
 * Loads configuration, creates health checks, and starts the sidecar.
 */
async function main(): Promise<void> {
  let config;
  if (process.env["LB_HOST"]) {
    // eslint-disable-next-line no-console
    console.log("Loading sidecar config from environment variables");
    config = loadSidecarConfigFromEnv();
  } else {
    const configPath = resolveConfigPath();
    // eslint-disable-next-line no-console
    console.log(`Loading sidecar config from ${configPath}`);
    config = loadSidecarConfig(configPath);
  }
  const checks = createHealthChecks(config.healthChecks);
  const sidecar = new Sidecar(config, checks);

  // Graceful shutdown on SIGINT / SIGTERM
  const shutdown = (): void => {
    // eslint-disable-next-line no-console
    console.log("\nSidecar shutting down...");
    void sidecar.stop().then(() => {
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await sidecar.start();

  // eslint-disable-next-line no-console
  console.log(
    `Sidecar started — connected to ${config.lbHost}:${config.lbPort}, `
    + `metrics on port ${config.metricsPort}, `
    + `health checks: [${config.healthChecks.join(", ")}]`,
  );
}

void main();
