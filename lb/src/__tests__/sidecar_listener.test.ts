import { describe, it, expect, afterEach } from "vitest";
import * as net from "node:net";
import { SidecarListener } from "../sidecar_listener.js";
import { DrainManager } from "../drain_manager.js";
import type { ServerConfig } from "../config.js";

const SERVER: ServerConfig = { host: "localhost", port: 3001, sidecarPort: 19201 };

/**
 * Connects a TCP client to the given port and returns the socket.
 * @param port - The port to connect to.
 * @returns A promise resolving to the connected socket.
 */
function connectClient(port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: "localhost" }, () => {
      resolve(socket);
    });
    socket.on("error", reject);
  });
}

/**
 * Waits for a short time to allow event loop processing.
 * @param ms - Milliseconds to wait.
 * @returns A promise that resolves after the delay.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

describe("SidecarListener", () => {
  let listener: SidecarListener | undefined;
  let dm: DrainManager;
  const sockets: net.Socket[] = [];

  afterEach(async () => {
    for (const s of sockets) {
      s.destroy();
    }
    sockets.length = 0;

    if (listener) {
      await listener.stop();
      listener = undefined;
    }
    dm?.shutdown();
  });

  it("processes a DRAIN command", async () => {
    dm = new DrainManager();
    listener = new SidecarListener([SERVER], dm);
    await listener.start();

    const client = await connectClient(19201);
    sockets.push(client);

    client.write("DRAIN:500\n");
    await wait(50);

    expect(dm.isDrained(SERVER)).toBe(true);
  });

  it("processes a RESUME command", async () => {
    dm = new DrainManager();
    listener = new SidecarListener([SERVER], dm);
    await listener.start();

    const client = await connectClient(19201);
    sockets.push(client);

    client.write("DRAIN:5000\n");
    await wait(50);
    expect(dm.isDrained(SERVER)).toBe(true);

    client.write("RESUME\n");
    await wait(50);
    expect(dm.isDrained(SERVER)).toBe(false);
  });

  it("handles multiple commands in one chunk", async () => {
    dm = new DrainManager();
    listener = new SidecarListener([SERVER], dm);
    await listener.start();

    const client = await connectClient(19201);
    sockets.push(client);

    client.write("DRAIN:500\nRESUME\n");
    await wait(50);

    // Last command wins
    expect(dm.isDrained(SERVER)).toBe(false);
  });

  it("skips servers without sidecarPort", async () => {
    dm = new DrainManager();
    const serverNoSidecar: ServerConfig = { host: "localhost", port: 3002 };
    listener = new SidecarListener([serverNoSidecar], dm);

    // Should start without creating any TCP servers
    await listener.start();
    await listener.stop();
    listener = undefined;
  });

  it("ignores invalid DRAIN durations", async () => {
    dm = new DrainManager();
    listener = new SidecarListener([SERVER], dm);
    await listener.start();

    const client = await connectClient(19201);
    sockets.push(client);

    client.write("DRAIN:notanumber\n");
    await wait(50);

    expect(dm.isDrained(SERVER)).toBe(false);
  });
});
