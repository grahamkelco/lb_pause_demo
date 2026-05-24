import { describe, it, expect } from "vitest";
import { RateLimiter } from "./rate_limiter.js";

describe("RateLimiter", () => {
  it("fires the correct number of callbacks", async () => {
    const rps = 100;
    const durationSec = 1;
    const limiter = new RateLimiter(rps, durationSec);

    let count = 0;
    await limiter.start(() => { count++; });

    expect(count).toBe(rps * durationSec);
  });

  it("can be stopped early", async () => {
    const limiter = new RateLimiter(100, 10);

    let count = 0;
    const promise = limiter.start(() => {
      count++;
      if (count >= 10) {
        limiter.stop();
      }
    });

    await promise;
    expect(count).toBe(10);
  });

  it("completes in approximately the expected duration", async () => {
    const rps = 50;
    const durationSec = 1;
    const limiter = new RateLimiter(rps, durationSec);

    const start = performance.now();
    let count = 0;
    await limiter.start(() => { count++; });
    const elapsed = performance.now() - start;

    expect(count).toBe(50);
    // Allow 20% tolerance
    expect(elapsed).toBeGreaterThan(800);
    expect(elapsed).toBeLessThan(1500);
  });
});
