import { createSocket, type Socket } from "node:dgram";
import type { HealthCheck } from "./health_check.js";

const DEFAULT_PORT = 9200;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_COOLDOWN_MS = 50;

/** Configuration options for {@link GcPauseCheck}. */
export interface GcPauseCheckConfig {
  readonly port?: number;
  readonly host?: string;
  readonly cooldownMs?: number;
}

/**
 * A health check that listens for JVM safepoint notifications over UDP.
 *
 * The Java GC server sends JSON datagrams when safepoints begin and end.
 * While a safepoint is active (plus a brief cooldown afterwards), this
 * check reports unhealthy so the load balancer can drain traffic away.
 */
export class GcPauseCheck implements HealthCheck {
  private readonly port: number;
  private readonly host: string;
  private readonly cooldownMs: number;
  private readonly socket: Socket;
  private healthyAfter: number = 0;
  private lastDrainMs: number = 0;

  /**
   * Creates a new GcPauseCheck and binds a UDP socket to receive safepoint events.
   * @param config - Optional configuration for port, host, and cooldown duration.
   */
  constructor(config?: GcPauseCheckConfig) {
    this.port = config?.port ?? DEFAULT_PORT;
    this.host = config?.host ?? DEFAULT_HOST;
    this.cooldownMs = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS;

    this.socket = createSocket("udp4");
    this.socket.on("message", (msg) => this.handleMessage(msg));
    this.socket.on("error", (err) => {
      console.error(`GcPauseCheck: UDP socket error: ${err.message}`);
    });
    this.socket.bind(this.port, this.host);
  }

  /**
   * Returns whether the server is currently healthy (not in a safepoint or cooldown).
   * @returns True if no safepoint is active and cooldown has elapsed.
   */
  isHealthy(): boolean {
    return Date.now() >= this.healthyAfter;
  }

  /**
   * Returns the drain interval based on the last observed pause duration.
   * @returns The drain duration in ms, at least as long as the configured cooldown.
   */
  getDrainInterval(): number {
    return Math.max(this.lastDrainMs, this.cooldownMs);
  }

  /**
   * Parses an incoming UDP datagram and updates health state.
   *
   * On safepoint_start, marks the server as unhealthy indefinitely.
   * On safepoint_end, starts a cooldown period before returning to healthy.
   * Malformed messages are silently ignored.
   * @param msg - The raw UDP message buffer.
   */
  private handleMessage(msg: Buffer): void {
    try {
      const parsed: unknown = JSON.parse(msg.toString("utf-8"));
      if (typeof parsed !== "object" || parsed === null) {
        return;
      }
      const data = parsed as Record<string, unknown>;

      if (data.event === "safepoint_start") {
        this.healthyAfter = Infinity;
      } else if (data.event === "safepoint_end") {
        const durationMs =
          typeof data.durationMs === "number" ? data.durationMs : 0;
        this.lastDrainMs = durationMs;
        const cooldown = Math.max(durationMs, this.cooldownMs);
        this.healthyAfter = Date.now() + cooldown;
      }
    } catch {
      // Ignore malformed messages
    }
  }
}
