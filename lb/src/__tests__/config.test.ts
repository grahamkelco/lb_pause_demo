import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../config.js";

/**
 * Helper to write a temp YAML file and return its path.
 * @param content - The YAML string to write.
 * @returns The path to the temp file.
 */
function writeTempYaml(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "lb-test-"));
  const filePath = join(dir, "config.yaml");
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("loadConfig", () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const f of tempFiles) {
      try {
        unlinkSync(f);
      } catch {
        // ignore cleanup errors
      }
    }
    tempFiles.length = 0;
  });

  it("parses a valid config with sidecar_port", () => {
    const path = writeTempYaml(`
listen:
  port: 8080
servers:
  - host: localhost
    port: 3001
    sidecar_port: 9001
  - host: 10.0.0.2
    port: 3002
`);
    tempFiles.push(path);

    const config = loadConfig(path);

    expect(config.listen.port).toBe(8080);
    expect(config.servers).toHaveLength(2);
    expect(config.servers[0]).toEqual({ host: "localhost", port: 3001, sidecarPort: 9001 });
    expect(config.servers[1]).toEqual({ host: "10.0.0.2", port: 3002 });
  });

  it("treats sidecarPort as optional", () => {
    const path = writeTempYaml(`
listen:
  port: 9000
servers:
  - host: example.com
    port: 80
`);
    tempFiles.push(path);

    const config = loadConfig(path);
    expect(config.servers[0]!.sidecarPort).toBeUndefined();
  });

  it("throws on missing listen section", () => {
    const path = writeTempYaml(`
servers:
  - host: localhost
    port: 3001
`);
    tempFiles.push(path);

    expect(() => loadConfig(path)).toThrow("listen");
  });

  it("throws on missing servers section", () => {
    const path = writeTempYaml(`
listen:
  port: 8080
`);
    tempFiles.push(path);

    expect(() => loadConfig(path)).toThrow("servers");
  });

  it("throws on empty servers array", () => {
    const path = writeTempYaml(`
listen:
  port: 8080
servers: []
`);
    tempFiles.push(path);

    expect(() => loadConfig(path)).toThrow("servers");
  });

  it("throws on missing host in server entry", () => {
    const path = writeTempYaml(`
listen:
  port: 8080
servers:
  - port: 3001
`);
    tempFiles.push(path);

    expect(() => loadConfig(path)).toThrow("host");
  });

  it("throws on missing port in server entry", () => {
    const path = writeTempYaml(`
listen:
  port: 8080
servers:
  - host: localhost
`);
    tempFiles.push(path);

    expect(() => loadConfig(path)).toThrow("port");
  });

  it("throws on non-numeric listen port", () => {
    const path = writeTempYaml(`
listen:
  port: "not-a-number"
servers:
  - host: localhost
    port: 3001
`);
    tempFiles.push(path);

    expect(() => loadConfig(path)).toThrow("listen.port");
  });
});
