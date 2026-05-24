import { describe, it, expect } from "vitest";
import { Metrics } from "./metrics.js";

describe("Metrics", () => {
  it("returns zero snapshot when empty", () => {
    const m = new Metrics();
    m.start();
    const snap = m.snapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.successCount).toBe(0);
    expect(snap.errorCount).toBe(0);
    expect(snap.p50).toBe(0);
  });

  it("records and computes percentiles correctly", () => {
    const m = new Metrics();
    m.start();
    // Record 100 values from 1 to 100
    for (let i = 1; i <= 100; i++) {
      m.record(i, true);
    }
    const snap = m.snapshot();
    expect(snap.totalRequests).toBe(100);
    expect(snap.successCount).toBe(100);
    expect(snap.errorCount).toBe(0);
    expect(snap.min).toBe(1);
    expect(snap.max).toBe(100);
    expect(snap.mean).toBe(50.5);
    expect(snap.p50).toBe(51);
    expect(snap.p99).toBe(100);
  });

  it("tracks errors separately", () => {
    const m = new Metrics();
    m.start();
    m.record(10, true);
    m.record(20, false);
    m.record(30, true);
    const snap = m.snapshot();
    expect(snap.totalRequests).toBe(3);
    expect(snap.successCount).toBe(2);
    expect(snap.errorCount).toBe(1);
  });

  it("computes rpsActual from elapsed time", () => {
    const m = new Metrics();
    m.start();
    m.record(1, true);
    const snap = m.snapshot();
    expect(snap.rpsActual).toBeGreaterThan(0);
    expect(snap.elapsedMs).toBeGreaterThan(0);
  });
});

describe("Metrics.merge", () => {
  it("returns zero snapshot for empty array", () => {
    const snap = Metrics.merge([]);
    expect(snap.totalRequests).toBe(0);
  });

  it("returns single snapshot unchanged", () => {
    const m = new Metrics();
    m.start();
    m.record(5, true);
    const original = m.snapshot();
    const merged = Metrics.merge([original]);
    expect(merged).toBe(original);
  });

  it("merges multiple snapshots correctly", () => {
    const m1 = new Metrics();
    m1.start();
    m1.record(10, true);
    m1.record(20, false);

    const m2 = new Metrics();
    m2.start();
    m2.record(5, true);
    m2.record(15, true);

    const merged = Metrics.merge([m1.snapshot(), m2.snapshot()]);
    expect(merged.totalRequests).toBe(4);
    expect(merged.successCount).toBe(3);
    expect(merged.errorCount).toBe(1);
    expect(merged.min).toBe(5);
    expect(merged.max).toBe(20);
  });
});
