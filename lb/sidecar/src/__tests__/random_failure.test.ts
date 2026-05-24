import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RandomFailure } from "../random_failure.js";

describe("RandomFailure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in a healthy state", () => {
    const check = new RandomFailure({ minHealthyMs: 5000, maxHealthyMs: 5000 });
    expect(check.isHealthy()).toBe(true);
  });

  it("transitions to unhealthy after the healthy period expires", () => {
    const check = new RandomFailure({
      minHealthyMs: 5000,
      maxHealthyMs: 5000,
      minFailureMs: 2000,
      maxFailureMs: 2000,
    });

    expect(check.isHealthy()).toBe(true);

    vi.setSystemTime(5000);
    expect(check.isHealthy()).toBe(false);
  });

  it("recovers after the failure period expires", () => {
    const check = new RandomFailure({
      minHealthyMs: 5000,
      maxHealthyMs: 5000,
      minFailureMs: 2000,
      maxFailureMs: 2000,
    });

    expect(check.isHealthy()).toBe(true);
    vi.setSystemTime(5000);
    expect(check.isHealthy()).toBe(false);
    vi.setSystemTime(6999);
    expect(check.isHealthy()).toBe(false);
    vi.setSystemTime(7000);
    expect(check.isHealthy()).toBe(true);
  });

  it("getDrainInterval returns the current failure duration when unhealthy", () => {
    const check = new RandomFailure({
      minHealthyMs: 5000,
      maxHealthyMs: 5000,
      minFailureMs: 3000,
      maxFailureMs: 3000,
    });

    expect(check.getDrainInterval()).toBe(3000);

    vi.setSystemTime(5000);
    check.isHealthy();

    expect(check.getDrainInterval()).toBe(3000);
  });

  it("getDrainInterval returns a positive value", () => {
    const check = new RandomFailure();
    expect(check.getDrainInterval()).toBeGreaterThan(0);
  });

  it("cycles through multiple healthy/unhealthy periods", () => {
    const check = new RandomFailure({
      minHealthyMs: 1000,
      maxHealthyMs: 1000,
      minFailureMs: 500,
      maxFailureMs: 500,
    });

    expect(check.isHealthy()).toBe(true);

    // First unhealthy period
    vi.setSystemTime(1000);
    expect(check.isHealthy()).toBe(false);

    // First recovery
    vi.setSystemTime(1500);
    expect(check.isHealthy()).toBe(true);

    // Second unhealthy period
    vi.setSystemTime(2500);
    expect(check.isHealthy()).toBe(false);

    // Second recovery
    vi.setSystemTime(3000);
    expect(check.isHealthy()).toBe(true);
  });
});
