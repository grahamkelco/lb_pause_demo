import { loadConfig } from "./config.js";
import { RoundRobinRouter } from "./router.js";
import { ProxyServer } from "./proxy_server.js";

const DEFAULT_CONFIG_PATH = "./lb_config.yaml";

/**
 * Resolves the config file path from CLI args, environment, or default.
 * @returns The resolved config file path.
 */
function resolveConfigPath(): string {
  return process.argv[2]
    ?? process.env["LB_CONFIG_PATH"]
    ?? DEFAULT_CONFIG_PATH;
}

/**
 * Main entry point for the load balancer process.
 * Loads configuration, creates the router and proxy server, and starts listening.
 */
async function main(): Promise<void> {
  const configPath = resolveConfigPath();

  // eslint-disable-next-line no-console
  console.log(`Loading config from ${configPath}`);

  const config = loadConfig(configPath);
  const router = new RoundRobinRouter(config.servers);
  const server = new ProxyServer(router, config.listen.port);

  // Graceful shutdown on SIGINT / SIGTERM
  const shutdown = (): void => {
    // eslint-disable-next-line no-console
    console.log("\nShutting down...");
    void server.stop().then(() => {
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.start();

  // eslint-disable-next-line no-console
  console.log(
    `Load balancer listening on port ${config.listen.port} `
    + `with ${router.serverCount} downstream server(s)`,
  );
}

void main();
