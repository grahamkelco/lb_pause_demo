/**
 * Simulates GC-like stop-the-world pauses by periodically blocking
 * the event loop using Atomics.wait on a SharedArrayBuffer.
 */
export class GcPauseSimulator {
  private readonly pauseDurationMs: number;
  private readonly minIntervalMs: number;
  private readonly maxIntervalMs: number;
  private readonly waitBuffer: Int32Array;
  private timer: ReturnType<typeof setTimeout> | null;
  private paused: boolean;

  /**
   * Creates a new GcPauseSimulator.
   * @param pauseDurationMs - How long each pause blocks the event loop.
   * @param minIntervalMs - Minimum delay between pauses.
   * @param maxIntervalMs - Maximum delay between pauses.
   */
  constructor(pauseDurationMs = 200, minIntervalMs = 5000, maxIntervalMs = 15000) {
    this.pauseDurationMs = pauseDurationMs;
    this.minIntervalMs = minIntervalMs;
    this.maxIntervalMs = maxIntervalMs;
    this.waitBuffer = new Int32Array(new SharedArrayBuffer(4));
    this.timer = null;
    this.paused = false;
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
   * Stops the pause simulator, clearing any pending timer.
   */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Schedules the next pause after a random delay.
   */
  private scheduleNext(): void {
    const delay = this.minIntervalMs +
      Math.random() * (this.maxIntervalMs - this.minIntervalMs);
    this.timer = setTimeout(() => {
      this.pause();
      this.scheduleNext();
    }, delay);
  }

  /**
   * Blocks the event loop for the configured duration.
   */
  private pause(): void {
    this.paused = true;
    Atomics.wait(this.waitBuffer, 0, 0, this.pauseDurationMs);
    this.paused = false;
  }
}
