import type { ServerConfig } from "./config.js";

/**
 * Internal state for a single server's drain status.
 */
interface DrainState {
  /** Whether the server is currently drained. */
  drained: boolean;
  /** Auto-resume timer, if active. */
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Manages per-server drain state for the load balancer.
 *
 * When a sidecar reports a pause via DRAIN, the server is marked as drained
 * and traffic is no longer routed to it. A RESUME command or an automatic
 * timeout re-enables routing.
 */
export class DrainManager {
  private readonly state = new Map<string, DrainState>();
  private backpressureEnabled: boolean = true;

  /**
   * Builds a map key from a server's host and port.
   * @param server - The server configuration.
   * @returns A string key in the form "host:port".
   */
  private static serverKey(server: ServerConfig): string {
    return `${server.host}:${server.port}`;
  }

  /**
   * Marks a server as drained for the given duration.
   *
   * If the server is already drained, the existing auto-resume timer is
   * replaced with a new one based on the updated duration.
   *
   * @param server - The server to drain.
   * @param durationMs - How long (in ms) before the server auto-resumes.
   */
  drain(server: ServerConfig, durationMs: number): void {
    const key = DrainManager.serverKey(server);
    const existing = this.state.get(key);

    // Clear any existing auto-resume timer
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.resume(server);
    }, durationMs);

    this.state.set(key, { drained: true, timer });
  }

  /**
   * Marks a server as available, clearing any pending auto-resume timer.
   * @param server - The server to resume.
   */
  resume(server: ServerConfig): void {
    const key = DrainManager.serverKey(server);
    const existing = this.state.get(key);

    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    this.state.set(key, { drained: false, timer: null });
  }

  /**
   * Returns whether a server is currently drained.
   * When backpressure is disabled, always returns false.
   * @param server - The server to check.
   * @returns True if the server is drained and should not receive traffic.
   */
  isDrained(server: ServerConfig): boolean {
    if (!this.backpressureEnabled) {
      return false;
    }
    const entry = this.state.get(DrainManager.serverKey(server));
    return entry?.drained ?? false;
  }

  /**
   * Returns whether backpressure-based draining is enabled.
   * @returns True if sidecar drain signals are being honored.
   */
  get enabled(): boolean {
    return this.backpressureEnabled;
  }

  /**
   * Enables or disables backpressure-based draining.
   * When disabled, isDrained() always returns false, effectively
   * making the router behave as plain round-robin.
   * @param value - True to honor drain signals, false to ignore them.
   */
  setEnabled(value: boolean): void {
    this.backpressureEnabled = value;
  }

  /**
   * Clears all drain timers. Called during shutdown.
   */
  shutdown(): void {
    for (const entry of this.state.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
    }
    this.state.clear();
  }
}
