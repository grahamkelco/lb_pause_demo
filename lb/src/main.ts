import { loadConfig } from "./config.js";
import { DrainManager } from "./drain_manager.js";
import { RoundRobinRouter } from "./router.js";
import { ProxyServer } from "./proxy_server.js";
import { SidecarListener } from "./sidecar_listener.js";
import { AdminHandler } from "./admin_handler.js";

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
  const drainManager = new DrainManager();
  const router = new RoundRobinRouter(config.servers, drainManager);
  const adminHandler = new AdminHandler(router);
  const server = new ProxyServer(router, config.listen.port, adminHandler);
  const sidecarListener = new SidecarListener(config.servers, drainManager);

  // Graceful shutdown on SIGINT / SIGTERM
  const shutdown = (): void => {
    // eslint-disable-next-line no-console
    console.log("\nShutting down...");
    void Promise.all([
      server.stop(),
      sidecarListener.stop(),
    ]).then(() => {
      drainManager.shutdown();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.all([
    server.start(),
    sidecarListener.start(),
  ]);

  // eslint-disable-next-line no-console
  console.log(
    `Load balancer listening on port ${config.listen.port} `
    + `with ${router.serverCount} downstream server(s)`,
  );
}

void main();
