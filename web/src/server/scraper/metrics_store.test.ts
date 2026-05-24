import { describe, it, expect } from "vitest";
import { MetricsStore } from "./metrics_store.js";

describe("MetricsStore", () => {
  it("records and retrieves metrics for a service", () => {
    const store = new MetricsStore(60_000);
    store.record("svc-a", { rps: 100 }, 1000);
    store.record("svc-a", { rps: 200 }, 2000);

    const result = store.getService("svc-a");
    expect(result).toBeDefined();
    expect(result!.name).toBe("svc-a");
    expect(result!.entries).toHaveLength(2);
    expect(result!.entries[0]!.metrics["rps"]).toBe(100);
    expect(result!.entries[1]!.metrics["rps"]).toBe(200);
  });

  it("returns undefined for unknown service", () => {
    const store = new MetricsStore(60_000);
    expect(store.getService("unknown")).toBeUndefined();
  });

  it("returns all services via getAll", () => {
    const store = new MetricsStore(60_000);
    store.record("svc-a", { rps: 100 }, 1000);
    store.record("svc-b", { rps: 200 }, 1000);

    const all = store.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.name).sort()).toEqual(["svc-a", "svc-b"]);
  });

  it("evicts entries older than retention window", () => {
    const store = new MetricsStore(5000);
    store.record("svc-a", { rps: 100 }, 1000);
    store.record("svc-a", { rps: 200 }, 3000);
    store.record("svc-a", { rps: 300 }, 7000);

    const result = store.getService("svc-a");
    expect(result).toBeDefined();
    // Entry at 1000 should be evicted (7000 - 5000 = 2000 cutoff)
    expect(result!.entries).toHaveLength(2);
    expect(result!.entries[0]!.metrics["rps"]).toBe(200);
    expect(result!.entries[1]!.metrics["rps"]).toBe(300);
  });

  it("returns defensive copies from getAll and getService", () => {
    const store = new MetricsStore(60_000);
    store.record("svc-a", { rps: 100 }, 1000);

    const result1 = store.getService("svc-a");
    const result2 = store.getService("svc-a");
    expect(result1!.entries).not.toBe(result2!.entries);
  });
});
