import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { LoadRunner } from "./load_runner.js";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        port = addr.port;
      }
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

describe("LoadRunner", () => {
  it("sends the expected number of requests", async () => {
    const rps = 20;
    const durationSec = 1;
    const runner = new LoadRunner({
      rps,
      durationSec,
      uri: `http://localhost:${String(port)}`,
    });

    const snapshot = await runner.run();

    expect(snapshot.totalRequests).toBe(rps * durationSec);
    expect(snapshot.successCount).toBe(rps * durationSec);
    expect(snapshot.errorCount).toBe(0);
    expect(snapshot.p50).toBeGreaterThan(0);
    expect(snapshot.mean).toBeGreaterThan(0);
  });

  it("records errors for unreachable targets", async () => {
    const runner = new LoadRunner({
      rps: 5,
      durationSec: 1,
      uri: "http://localhost:1",
    });

    const snapshot = await runner.run();
    expect(snapshot.totalRequests).toBe(5);
    expect(snapshot.errorCount).toBe(5);
  });
});
