import { describe, it, expect, vi, afterEach } from "vitest";
import { HealthCheckRunner } from "../health_check_runner.js";
import type { HealthCheck } from "../health_check.js";

/**
 * Creates a mock health check with controllable state.
 * @param healthy - Initial health state.
 * @param drainInterval - The drain interval to report.
 * @returns A mock HealthCheck with a setHealthy method.
 */
function createMockCheck(
  healthy: boolean,
  drainInterval: number,
): HealthCheck & { setHealthy: (v: boolean) => void } {
  let state = healthy;
  return {
    isHealthy: () => state,
    getDrainInterval: () => drainInterval,
    setHealthy: (v: boolean) => { state = v; },
  };
}

describe("HealthCheckRunner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts healthy when all checks pass", () => {
    const check = createMockCheck(true, 200);
    const runner = new HealthCheckRunner([check]);
    expect(runner.healthy).toBe(true);
  });

  it("computes drainInterval as max of all checks", () => {
    const a = createMockCheck(true, 100);
    const b = createMockCheck(true, 300);
    const runner = new HealthCheckRunner([a, b]);
    expect(runner.drainInterval).toBe(300);
  });

  it("emits stateChange when a check fails", () => {
    vi.useFakeTimers();

    const check = createMockCheck(true, 200);
    const runner = new HealthCheckRunner([check], 10);
    const changes: boolean[] = [];

    runner.on("stateChange", (healthy: boolean) => {
      changes.push(healthy);
    });

    runner.start();

    // Transition to unhealthy
    check.setHealthy(false);
    vi.advanceTimersByTime(10);
    expect(changes).toEqual([false]);
    expect(runner.healthy).toBe(false);

    // Transition back to healthy
    check.setHealthy(true);
    vi.advanceTimersByTime(10);
    expect(changes).toEqual([false, true]);
    expect(runner.healthy).toBe(true);

    runner.stop();
    vi.useRealTimers();
  });

  it("does not emit when state remains the same", () => {
    vi.useFakeTimers();

    const check = createMockCheck(true, 200);
    const runner = new HealthCheckRunner([check], 10);
    const changes: boolean[] = [];

    runner.on("stateChange", (healthy: boolean) => {
      changes.push(healthy);
    });

    runner.start();
    vi.advanceTimersByTime(100);
    expect(changes).toEqual([]);

    runner.stop();
    vi.useRealTimers();
  });

  it("requires all checks to pass for healthy", () => {
    vi.useFakeTimers();

    const a = createMockCheck(true, 200);
    const b = createMockCheck(true, 200);
    const runner = new HealthCheckRunner([a, b], 10);

    runner.start();

    // One fails — should be unhealthy
    b.setHealthy(false);
    vi.advanceTimersByTime(10);
    expect(runner.healthy).toBe(false);

    runner.stop();
    vi.useRealTimers();
  });

  it("stops cleanly", () => {
    vi.useFakeTimers();

    const check = createMockCheck(true, 200);
    const runner = new HealthCheckRunner([check], 10);
    runner.start();
    runner.stop();

    // Should not emit after stop
    const changes: boolean[] = [];
    runner.on("stateChange", (healthy: boolean) => {
      changes.push(healthy);
    });

    check.setHealthy(false);
    vi.advanceTimersByTime(100);
    expect(changes).toEqual([]);

    vi.useRealTimers();
  });
});
