import { describe, it, expect, afterEach } from "vitest";
import * as net from "node:net";
import { LbConnection } from "../lb_connection.js";

const TEST_PORT = 19301;

/**
 * Waits for a short time to allow event loop processing.
 * @param ms - Milliseconds to wait.
 * @returns A promise that resolves after the delay.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

describe("LbConnection", () => {
  let tcpServer: net.Server | undefined;
  let conn: LbConnection | undefined;

  afterEach(async () => {
    conn?.disconnect();
    conn = undefined;

    if (tcpServer) {
      await new Promise<void>((resolve) => {
        tcpServer!.close(() => { resolve(); });
      });
      tcpServer = undefined;
    }
  });

  it("connects and sends DRAIN command", async () => {
    const received: string[] = [];

    tcpServer = net.createServer((socket) => {
      socket.on("data", (data) => {
        received.push(data.toString());
      });
    });

    await new Promise<void>((resolve) => {
      tcpServer!.listen(TEST_PORT, resolve);
    });

    conn = new LbConnection("localhost", TEST_PORT);
    await conn.connect();

    expect(conn.connected).toBe(true);

    conn.sendDrain(500);
    await wait(50);

    expect(received.join("")).toContain("DRAIN:500\n");
  });

  it("sends RESUME command", async () => {
    const received: string[] = [];

    tcpServer = net.createServer((socket) => {
      socket.on("data", (data) => {
        received.push(data.toString());
      });
    });

    await new Promise<void>((resolve) => {
      tcpServer!.listen(TEST_PORT, resolve);
    });

    conn = new LbConnection("localhost", TEST_PORT);
    await conn.connect();

    conn.sendResume();
    await wait(50);

    expect(received.join("")).toContain("RESUME\n");
  });

  it("handles connection to a non-listening port gracefully", async () => {
    // Port 19399 has nothing listening
    conn = new LbConnection("localhost", 19399);
    await conn.connect();

    expect(conn.connected).toBe(false);
  });

  it("disconnects cleanly", async () => {
    tcpServer = net.createServer(() => {
      // Accept but do nothing
    });

    await new Promise<void>((resolve) => {
      tcpServer!.listen(TEST_PORT, resolve);
    });

    conn = new LbConnection("localhost", TEST_PORT);
    await conn.connect();

    expect(conn.connected).toBe(true);

    conn.disconnect();
    expect(conn.connected).toBe(false);
  });
});
