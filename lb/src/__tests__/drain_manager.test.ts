import { describe, it, expect, vi, afterEach } from "vitest";
import { DrainManager } from "../drain_manager.js";
import type { ServerConfig } from "../config.js";

const SERVER_A: ServerConfig = { host: "a", port: 1 };
const SERVER_B: ServerConfig = { host: "b", port: 2 };

describe("DrainManager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports servers as not drained by default", () => {
    const dm = new DrainManager();
    expect(dm.isDrained(SERVER_A)).toBe(false);
  });

  it("marks a server as drained", () => {
    const dm = new DrainManager();
    dm.drain(SERVER_A, 1000);

    expect(dm.isDrained(SERVER_A)).toBe(true);
    expect(dm.isDrained(SERVER_B)).toBe(false);

    dm.shutdown();
  });

  it("resumes a drained server", () => {
    const dm = new DrainManager();
    dm.drain(SERVER_A, 1000);
    dm.resume(SERVER_A);

    expect(dm.isDrained(SERVER_A)).toBe(false);

    dm.shutdown();
  });

  it("auto-resumes after the drain duration", () => {
    vi.useFakeTimers();

    const dm = new DrainManager();
    dm.drain(SERVER_A, 500);

    expect(dm.isDrained(SERVER_A)).toBe(true);

    vi.advanceTimersByTime(499);
    expect(dm.isDrained(SERVER_A)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(dm.isDrained(SERVER_A)).toBe(false);

    vi.useRealTimers();
  });

  it("resets the auto-resume timer on successive drain calls", () => {
    vi.useFakeTimers();

    const dm = new DrainManager();
    dm.drain(SERVER_A, 500);

    vi.advanceTimersByTime(400);
    expect(dm.isDrained(SERVER_A)).toBe(true);

    // Re-drain with a new duration — timer resets
    dm.drain(SERVER_A, 500);

    vi.advanceTimersByTime(400);
    expect(dm.isDrained(SERVER_A)).toBe(true);

    vi.advanceTimersByTime(100);
    expect(dm.isDrained(SERVER_A)).toBe(false);

    vi.useRealTimers();
  });

  it("handles resume on a server that was never drained", () => {
    const dm = new DrainManager();
    dm.resume(SERVER_A);
    expect(dm.isDrained(SERVER_A)).toBe(false);
  });

  it("clears all timers on shutdown", () => {
    vi.useFakeTimers();

    const dm = new DrainManager();
    dm.drain(SERVER_A, 500);
    dm.drain(SERVER_B, 500);

    dm.shutdown();

    // Timers should be cleared — advancing time should not cause errors
    vi.advanceTimersByTime(1000);

    vi.useRealTimers();
  });
});
