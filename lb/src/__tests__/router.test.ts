import { describe, it, expect } from "vitest";
import { RoundRobinRouter } from "../router.js";
import { DrainManager } from "../drain_manager.js";
import type { ServerConfig } from "../config.js";

const SERVERS: readonly ServerConfig[] = [
  { host: "a", port: 1 },
  { host: "b", port: 2 },
  { host: "c", port: 3 },
];

const TYPED_SERVERS: readonly ServerConfig[] = [
  { host: "s1", port: 8080, type: "sinkhole" },
  { host: "s2", port: 8080, type: "sinkhole" },
  { host: "s3", port: 8080, type: "sinkhole" },
  { host: "s4", port: 8080, type: "sinkhole" },
];

describe("RoundRobinRouter", () => {
  it("cycles through servers in order", () => {
    const router = new RoundRobinRouter(SERVERS);
    const results = Array.from({ length: 6 }, () => router.next());

    expect(results.map((s) => s?.host)).toEqual(["a", "b", "c", "a", "b", "c"]);
  });

  it("returns the same server when only one is configured", () => {
    const router = new RoundRobinRouter([{ host: "solo", port: 1 }]);

    expect(router.next()?.host).toBe("solo");
    expect(router.next()?.host).toBe("solo");
    expect(router.next()?.host).toBe("solo");
  });

  it("throws when constructed with an empty array", () => {
    expect(() => new RoundRobinRouter([])).toThrow("at least one server");
  });

  it("reports the correct server count", () => {
    const router = new RoundRobinRouter(SERVERS);
    expect(router.serverCount).toBe(3);
  });

  it("skips drained servers", () => {
    const dm = new DrainManager();
    const router = new RoundRobinRouter(SERVERS, dm);

    dm.drain(SERVERS[1]!, 5000);

    // Should skip "b" and return a, c, a, c
    const results = Array.from({ length: 4 }, () => router.next());
    expect(results.map((s) => s?.host)).toEqual(["a", "c", "a", "c"]);

    dm.shutdown();
  });

  it("returns null when all servers are drained", () => {
    const dm = new DrainManager();
    const router = new RoundRobinRouter(SERVERS, dm);

    for (const server of SERVERS) {
      dm.drain(server, 5000);
    }

    expect(router.next()).toBeNull();

    dm.shutdown();
  });

  it("resumes routing after a server is un-drained", () => {
    const dm = new DrainManager();
    const router = new RoundRobinRouter(SERVERS, dm);

    for (const server of SERVERS) {
      dm.drain(server, 5000);
    }

    expect(router.next()).toBeNull();

    dm.resume(SERVERS[0]!);
    expect(router.next()?.host).toBe("a");

    dm.shutdown();
  });
});

describe("RoundRobinRouter type-based routing", () => {
  it("returns server groups with correct totals", () => {
    const router = new RoundRobinRouter(TYPED_SERVERS);
    const groups = router.getServerGroups();

    expect(groups).toEqual([
      { type: "sinkhole", total: 4, active: 4 },
    ]);
  });

  it("routes only to active type when set", () => {
    const router = new RoundRobinRouter(TYPED_SERVERS);
    router.setActiveType("sinkhole");

    const results = Array.from({ length: 4 }, () => router.next());
    expect(results.map((s) => s?.host)).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("limits routing to activeCount servers", () => {
    const router = new RoundRobinRouter(TYPED_SERVERS);
    router.setActiveType("sinkhole");
    router.setActiveServers("sinkhole", 2);

    const results = Array.from({ length: 4 }, () => router.next());
    expect(results.map((s) => s?.host)).toEqual(["s1", "s2", "s1", "s2"]);
  });

  it("throws when activeCount exceeds total", () => {
    const router = new RoundRobinRouter(TYPED_SERVERS);
    expect(() => router.setActiveServers("sinkhole", 5)).toThrow("Invalid count");
  });

  it("throws when activeCount is negative", () => {
    const router = new RoundRobinRouter(TYPED_SERVERS);
    expect(() => router.setActiveServers("sinkhole", -1)).toThrow("Invalid count");
  });

  it("returns null when activeCount is zero", () => {
    const router = new RoundRobinRouter(TYPED_SERVERS);
    router.setActiveType("sinkhole");
    router.setActiveServers("sinkhole", 0);

    expect(router.next()).toBeNull();
  });

  it("returns empty groups when no servers have types", () => {
    const router = new RoundRobinRouter(SERVERS);
    expect(router.getServerGroups()).toEqual([]);
  });
});
