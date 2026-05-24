import type { ServerConfig } from "./config.js";

/**
 * Routes requests to downstream servers using a round-robin strategy.
 * Each call to next() returns the next server in rotation.
 */
export class RoundRobinRouter {
  private readonly servers: readonly ServerConfig[];
  private currentIndex: number = 0;

  /**
   * Creates a new RoundRobinRouter.
   * @param servers - Non-empty list of downstream server configurations.
   */
  constructor(servers: readonly ServerConfig[]) {
    if (servers.length === 0) {
      throw new Error("RoundRobinRouter requires at least one server");
    }
    this.servers = servers;
  }

  /**
   * Returns the next server in the round-robin rotation.
   * @returns The next ServerConfig to route a request to.
   */
  next(): ServerConfig {
    // Index is always in bounds because we mod by length and validate non-empty in constructor
    const server = this.servers[this.currentIndex]!;
    this.currentIndex = (this.currentIndex + 1) % this.servers.length;
    return server;
  }

  /**
   * Returns the number of configured downstream servers.
   * @returns The server count.
   */
  get serverCount(): number {
    return this.servers.length;
  }
}
