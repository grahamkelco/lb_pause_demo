import * as crypto from "node:crypto";

/** Interval between safepoint checks during CPU work, in iterations. */
const SAFEPOINT_CHECK_INTERVAL = 100;

/**
 * Performs synchronous CPU work by repeatedly hashing a buffer.
 * Each iteration feeds the previous digest as input, creating
 * a fixed amount of compute (not a fixed duration).
 *
 * Periodically calls the optional safepoint callback, simulating
 * JVM-style safepoint polls at loop back-edges. This allows a
 * GC pause to interrupt the work mid-computation, just as a real
 * stop-the-world GC would pause a thread mid-execution.
 *
 * @param iterations - Number of SHA-256 rounds to perform.
 * @param safepoint - Optional callback invoked every 100 iterations.
 */
export function doCpuWork(iterations = 2000, safepoint?: () => void): void {
  let buffer = Buffer.from("backpressure-seed");
  for (let i = 0; i < iterations; i++) {
    buffer = crypto.createHash("sha256").update(buffer).digest();
    if (safepoint && i % SAFEPOINT_CHECK_INTERVAL === 0) {
      safepoint();
    }
  }
}
