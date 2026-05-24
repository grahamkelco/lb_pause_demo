import * as crypto from "node:crypto";

/**
 * Performs synchronous CPU work by repeatedly hashing a buffer.
 * Each iteration feeds the previous digest as input, creating
 * a fixed amount of compute (not a fixed duration).
 *
 * @param iterations - Number of SHA-256 rounds to perform.
 */
export function doCpuWork(iterations = 2000): void {
  let buffer = Buffer.from("backpressure-seed");
  for (let i = 0; i < iterations; i++) {
    buffer = crypto.createHash("sha256").update(buffer).digest();
  }
}
