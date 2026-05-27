import { createSocket, type Socket } from "node:dgram";

/** Configuration for the GC pause simulator. */
export interface GcPauseSimulatorConfig {
  /** How long each pause blocks the event loop, in ms. */
  readonly pauseDurationMs?: number;
  /** Minimum delay between pauses, in ms. */
  readonly minIntervalMs?: number;
  /** Maximum delay between pauses, in ms. */
  readonly maxIntervalMs?: number;
  /** Sidecar hostname to send UDP notifications to. */
  readonly sidecarHost?: string;
  /** Sidecar UDP port to send notifications to. */
  readonly sidecarPort?: number;
}

const DEFAULT_PAUSE_DURATION_MS = 1500;
const DEFAULT_MIN_INTERVAL_MS = 15000;
const DEFAULT_MAX_INTERVAL_MS = 45000;
const DEFAULT_SIDECAR_PORT = 9200;

/**
 * Simulates GC-like stop-the-world pauses using a safepoint model.
 *
 * A background timer arms a pending pause at random intervals. The pause
 * is not executed in the timer callback — instead, application code calls
 * {@link checkSafepoint} at regular intervals (like JVM loop back-edge
 * safepoints). When the flag is set, the safepoint check blocks the
 * event loop with Atomics.wait, pausing the request mid-execution.
 *
 * Sends UDP safepoint_start/safepoint_end notifications to the sidecar
 * so its GcPauseCheck can detect the pauses and drain traffic.
 */
export class GcPauseSimulator {
  private readonly pauseDurationMs: number;
  private readonly minIntervalMs: number;
  private readonly maxIntervalMs: number;
  private readonly sidecarHost: string | null;
  private readonly sidecarPort: number;
  private readonly socket: Socket | null;
  private timer: ReturnType<typeof setTimeout> | null;
  private paused: boolean;
  private pausePending: boolean;

  /**
   * Creates a new GcPauseSimulator.
   * @param config - Optional configuration overrides.
   */
  constructor(config?: GcPauseSimulatorConfig) {
    this.pauseDurationMs = config?.pauseDurationMs ?? DEFAULT_PAUSE_DURATION_MS;
    this.minIntervalMs = config?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.maxIntervalMs = config?.maxIntervalMs ?? DEFAULT_MAX_INTERVAL_MS;
    this.sidecarHost = config?.sidecarHost ?? null;
    this.sidecarPort = config?.sidecarPort ?? DEFAULT_SIDECAR_PORT;
    this.timer = null;
    this.paused = false;
    this.pausePending = false;

    // Only create a UDP socket if a sidecar host is configured
    this.socket = this.sidecarHost ? createSocket("udp4") : null;
  }

  /**
   * Whether the simulator is currently in a blocking pause.
   * @returns true if the event loop is blocked by a simulated GC pause.
   */
  get isPaused(): boolean {
    return this.paused;
  }

  /**
   * Starts the pause simulator, scheduling the first pause.
   */
  start(): void {
    this.scheduleNext();
  }

  /**
   * Stops the pause simulator, clearing any pending timer and closing the socket.
   */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pausePending = false;
    this.socket?.close();
  }

  /**
   * Checks whether a GC pause is pending and executes it if so.
   *
   * This simulates a JVM safepoint check. Application code should call
   * this at regular intervals during CPU-bound work (e.g. every N loop
   * iterations), just as the JVM inserts safepoint polls at loop
   * back-edges and method returns. When a pause is pending, this method
   * blocks the calling thread for the configured duration.
   */
  checkSafepoint(): void {
    if (!this.pausePending) {
      return;
    }
    this.pausePending = false;
    this.executePause();
  }

  /**
   * Schedules the next pause after a random delay.
   */
  private scheduleNext(): void {
    const delay = this.minIntervalMs +
      Math.random() * (this.maxIntervalMs - this.minIntervalMs);
    this.timer = setTimeout(() => {
      // Arm the pending flag — the actual pause happens at the next safepoint check
      this.pausePending = true;
      this.scheduleNext();
    }, delay);
  }

  /**
   * Sends UDP notifications and burns CPU for the configured duration.
   *
   * Uses a tight spin loop rather than Atomics.wait so the core stays
   * hot — simulating real GC work (scanning, compacting) that competes
   * for CPU with application threads.
   */
  private executePause(): void {
    this.paused = true;
    this.sendNotification({ event: "safepoint_start" });
    this.busySpin(this.pauseDurationMs);
    this.paused = false;
    this.sendNotification({ event: "safepoint_end", durationMs: this.pauseDurationMs });
  }

  /**
   * Spins the CPU for the given duration using performance.now() as the clock.
   * @param durationMs - How long to spin in milliseconds.
   */
  private busySpin(durationMs: number): void {
    const deadline = performance.now() + durationMs;
    let x = 0;
    while (performance.now() < deadline) {
      // Arithmetic spin to keep the core busy
      x = (x + 1) | 0;
    }
    // Prevent dead-code elimination
    if (x < 0) throw new Error("unreachable");
  }

  /**
   * Sends a JSON UDP datagram to the sidecar.
   * @param payload - The notification payload to send.
   */
  private sendNotification(payload: Record<string, unknown>): void {
    if (!this.socket || !this.sidecarHost) {
      return;
    }
    const msg = Buffer.from(JSON.stringify(payload));
    this.socket.send(msg, this.sidecarPort, this.sidecarHost);
  }
}
