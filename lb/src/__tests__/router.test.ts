import { describe, it, expect } from "vitest";
import { RoundRobinRouter } from "../router.js";
import type { ServerConfig } from "../config.js";

const SERVERS: readonly ServerConfig[] = [
  { host: "a", port: 1 },
  { host: "b", port: 2 },
  { host: "c", port: 3 },
];

describe("RoundRobinRouter", () => {
  it("cycles through servers in order", () => {
    const router = new RoundRobinRouter(SERVERS);
    const results = Array.from({ length: 6 }, () => router.next());

    expect(results.map((s) => s.host)).toEqual(["a", "b", "c", "a", "b", "c"]);
  });

  it("returns the same server when only one is configured", () => {
    const router = new RoundRobinRouter([{ host: "solo", port: 1 }]);

    expect(router.next().host).toBe("solo");
    expect(router.next().host).toBe("solo");
    expect(router.next().host).toBe("solo");
  });

  it("throws when constructed with an empty array", () => {
    expect(() => new RoundRobinRouter([])).toThrow("at least one server");
  });

  it("reports the correct server count", () => {
    const router = new RoundRobinRouter(SERVERS);
    expect(router.serverCount).toBe(3);
  });
});
