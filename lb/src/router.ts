import type { ServerConfig } from "./config.js";
import type { DrainManager } from "./drain_manager.js";

/**
 * Summary of a server type group, used by the admin API.
 */
export interface ServerGroup {
  /** The type tag (e.g., "sinkhole"). */
  type: string;
  /** Total number of servers configured with this type. */
  total: number;
  /** Number currently active (eligible for routing). */
  active: number;
}

/**
 * Routes requests to downstream servers using a round-robin strategy.
 * Supports type-based filtering and per-type active counts.
 */
export class RoundRobinRouter {
  private readonly servers: readonly ServerConfig[];
  private readonly drainManager: DrainManager | undefined;
  private currentIndex: number = 0;
  private activeType: string | null = null;
  private readonly activeCountByType = new Map<string, number>();

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

    // Initialize active counts to full count per type
    for (const server of servers) {
      if (server.type) {
        const current = this.activeCountByType.get(server.type) ?? 0;
        this.activeCountByType.set(server.type, current + 1);
      }
    }
    this.drainManager = drainManager;
  }

  /**
   * Returns the next available server in the round-robin rotation.
   *
   * When an active type is set, only considers servers of that type
   * up to the active count. Skips drained servers. Returns null when
   * no eligible server is found.
   *
   * @returns The next available ServerConfig, or null if none eligible.
   */
  next(): ServerConfig | null {
    const eligible = this.buildEligibleList();
    if (eligible.length === 0) {
      return null;
    }

    // Wrap currentIndex within eligible bounds
    this.currentIndex = this.currentIndex % eligible.length;

    for (let i = 0; i < eligible.length; i++) {
      const server = eligible[this.currentIndex]!;
      this.currentIndex = (this.currentIndex + 1) % eligible.length;

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

  /**
   * Sets the active server count for a given type.
   * @param type - The server type tag.
   * @param count - Number of servers of this type to keep active.
   */
  setActiveServers(type: string, count: number): void {
    const total = this.countServersOfType(type);
    if (count < 0 || count > total) {
      throw new Error(
        `Invalid count ${count} for type "${type}" (total: ${total})`,
      );
    }
    this.activeCountByType.set(type, count);
    this.currentIndex = 0;
  }

  /**
   * Sets which server type the router is currently routing to.
   * @param type - The type tag to route to, or null to route to all.
   */
  setActiveType(type: string | null): void {
    this.activeType = type;
    this.currentIndex = 0;
  }

  /**
   * Returns summary information for each server type group.
   * @returns Array of server group summaries.
   */
  getServerGroups(): ServerGroup[] {
    const typeCounts = new Map<string, number>();
    for (const server of this.servers) {
      if (server.type) {
        typeCounts.set(server.type, (typeCounts.get(server.type) ?? 0) + 1);
      }
    }

    const groups: ServerGroup[] = [];
    for (const [type, total] of typeCounts) {
      groups.push({
        type,
        total,
        active: this.activeCountByType.get(type) ?? total,
      });
    }
    return groups;
  }

  /**
   * Builds the list of servers eligible for routing based on active type and counts.
   * @returns Array of eligible server configs.
   */
  private buildEligibleList(): ServerConfig[] {
    if (this.activeType === null) {
      return [...this.servers];
    }

    const activeCount = this.activeCountByType.get(this.activeType) ?? 0;
    const eligible: ServerConfig[] = [];
    let seen = 0;

    for (const server of this.servers) {
      if (server.type === this.activeType) {
        if (seen < activeCount) {
          eligible.push(server);
        }
        seen++;
      }
    }
    return eligible;
  }

  /**
   * Counts the total number of servers with a given type.
   * @param type - The type to count.
   * @returns The count.
   */
  private countServersOfType(type: string): number {
    return this.servers.filter((s) => s.type === type).length;
  }
}
