import { describe, it, expect } from "vitest";
import * as http from "node:http";
import { RoundRobinRouter } from "../router.js";
import { AdminHandler } from "../admin_handler.js";
import { DrainManager } from "../drain_manager.js";
import type { ServerConfig } from "../config.js";

const SERVERS: readonly ServerConfig[] = [
  { host: "s1", port: 8080, type: "sinkhole" },
  { host: "s2", port: 8080, type: "sinkhole" },
  { host: "s3", port: 8080, type: "sinkhole" },
  { host: "s4", port: 8080, type: "sinkhole" },
];

/**
 * Creates a test HTTP server with the admin handler and returns the base URL.
 */
async function createTestServer(): Promise<{ url: string; server: http.Server }> {
  const router = new RoundRobinRouter(SERVERS);
  const handler = new AdminHandler(router, new DrainManager());

  const server = http.createServer((req, res) => {
    if (!handler.handleRequest(req, res)) {
      res.writeHead(404);
      res.end();
    }
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        resolve({ url: `http://localhost:${String(addr.port)}`, server });
      }
    });
  });
}

describe("AdminHandler", () => {
  it("GET /admin/servers returns server groups", async () => {
    const { url, server } = await createTestServer();
    try {
      const res = await fetch(`${url}/admin/servers`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as Array<{ type: string; total: number; active: number }>;
      expect(data).toEqual([{ type: "sinkhole", total: 4, active: 4 }]);
    } finally {
      server.close();
    }
  });

  it("POST /admin/servers updates active count", async () => {
    const { url, server } = await createTestServer();
    try {
      const res = await fetch(`${url}/admin/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sinkhole", activeCount: 2 }),
      });
      expect(res.status).toBe(200);

      const getRes = await fetch(`${url}/admin/servers`);
      const data = (await getRes.json()) as Array<{ type: string; total: number; active: number }>;
      expect(data).toEqual([{ type: "sinkhole", total: 4, active: 2 }]);
    } finally {
      server.close();
    }
  });

  it("POST /admin/servers rejects invalid count", async () => {
    const { url, server } = await createTestServer();
    try {
      const res = await fetch(`${url}/admin/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sinkhole", activeCount: 10 }),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });

  it("returns false for non-admin paths", () => {
    const router = new RoundRobinRouter(SERVERS);
    const handler = new AdminHandler(router, new DrainManager());

    const req = { url: "/query" } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    expect(handler.handleRequest(req, res)).toBe(false);
  });
});
