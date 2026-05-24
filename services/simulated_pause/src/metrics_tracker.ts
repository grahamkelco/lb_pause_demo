/**
 * Tracks request rates using a circular buffer of per-second counts
 * over a sliding window.
 */
export class MetricsTracker {
  private readonly windowSize: number;
  private readonly slots: number[];
  private currentSlot: number;
  private totalRequests: number;
  private timer: ReturnType<typeof setInterval> | null;

  /**
   * Creates a new MetricsTracker.
   * @param windowSize - Number of seconds in the sliding window.
   */
  constructor(windowSize = 10) {
    this.windowSize = windowSize;
    this.slots = new Array<number>(windowSize).fill(0);
    this.currentSlot = 0;
    this.totalRequests = 0;
    this.timer = null;
  }

  /**
   * Starts the per-second slot rotation timer.
   */
  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.currentSlot = (this.currentSlot + 1) % this.windowSize;
      this.slots[this.currentSlot] = 0;
    }, 1_000);
  }

  /**
   * Stops the slot rotation timer.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Records a single incoming request.
   */
  recordRequest(): void {
    // currentSlot is always within bounds due to modulo arithmetic
    this.slots[this.currentSlot] = (this.slots[this.currentSlot] ?? 0) + 1;
    this.totalRequests++;
  }

  /**
   * Calculates the current requests per second over the sliding window.
   * @returns The average RPS across all window slots.
   */
  getRps(): number {
    let sum = 0;
    for (const count of this.slots) {
      sum += count;
    }
    return sum / this.windowSize;
  }

  /**
   * Returns the total number of requests recorded since creation.
   * @returns The monotonic total request count.
   */
  getTotalRequests(): number {
    return this.totalRequests;
  }
}
