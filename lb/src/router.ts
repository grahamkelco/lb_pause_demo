import type { ServerConfig } from "./config.js";
import type { DrainManager } from "./drain_manager.js";

/**
 * Routes requests to downstream servers using a round-robin strategy.
 * Each call to next() returns the next server in rotation, skipping
 * any servers that are currently drained.
 */
export class RoundRobinRouter {
  private readonly servers: readonly ServerConfig[];
  private readonly drainManager: DrainManager | undefined;
  private currentIndex: number = 0;

  /**
   * Creates a new RoundRobinRouter.
   * @param servers - Non-empty list of downstream server configurations.
   * @param drainManager - Optional drain manager for filtering drained servers.
   */
  constructor(servers: readonly ServerConfig[], drainManager?: DrainManager) {
    if (servers.length === 0) {
      throw new Error("RoundRobinRouter requires at least one server");
    }
    this.servers = servers;
    this.drainManager = drainManager;
  }

  /**
   * Returns the next available server in the round-robin rotation.
   *
   * Skips servers that are currently drained. Returns null when every
   * server in the pool is drained.
   *
   * @returns The next available ServerConfig, or null if all servers are drained.
   */
  next(): ServerConfig | null {
    for (let i = 0; i < this.servers.length; i++) {
      const server = this.servers[this.currentIndex]!;
      this.currentIndex = (this.currentIndex + 1) % this.servers.length;

      if (!this.drainManager?.isDrained(server)) {
        return server;
      }
    }
    return null;
  }

  /**
   * Returns the number of configured downstream servers.
   * @returns The server count.
   */
  get serverCount(): number {
    return this.servers.length;
  }
}
