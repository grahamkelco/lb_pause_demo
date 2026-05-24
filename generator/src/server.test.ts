import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { GeneratorServer } from "./server.js";

let targetServer: Server;
let targetPort: number;
let generatorPort: number;

beforeAll(async () => {
  // Start a simple target server for the generator to hit
  targetServer = createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise<void>((resolve) => {
    targetServer.listen(0, () => {
      const addr = targetServer.address();
      if (addr && typeof addr === "object") {
        targetPort = addr.port;
      }
      resolve();
    });
  });

  // Start the generator server
  const genServer = new GeneratorServer();
  const addr = await genServer.listen(0);
  generatorPort = addr.port;
});

afterAll(() => {
  targetServer.close();
});

describe("GeneratorServer", () => {
  it("responds to /health", async () => {
    const res = await fetch(`http://localhost:${String(generatorPort)}/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  it("returns 204 for /metrics with no prior run", async () => {
    const res = await fetch(`http://localhost:${String(generatorPort)}/metrics`);
    expect(res.status).toBe(204);
  });

  it("returns 404 for unknown paths", async () => {
    const res = await fetch(`http://localhost:${String(generatorPort)}/unknown`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for /run with missing params", async () => {
    const res = await fetch(`http://localhost:${String(generatorPort)}/run`);
    expect(res.status).toBe(400);
  });

  it("executes a run and returns metrics", async () => {
    const uri = encodeURIComponent(`http://localhost:${String(targetPort)}`);
    const url = `http://localhost:${String(generatorPort)}/run?rps=10&duration=1&uri=${uri}&threads=1`;
    const res = await fetch(url);
    expect(res.status).toBe(200);

    const body = await res.json() as { totalRequests: number; successCount: number };
    expect(body.totalRequests).toBe(10);
    expect(body.successCount).toBe(10);
  });

  it("returns metrics in OpenTelemetry format after a run", async () => {
    const res = await fetch(`http://localhost:${String(generatorPort)}/metrics`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("generator_requests_total");
    expect(text).toContain("# TYPE");
  });
});
