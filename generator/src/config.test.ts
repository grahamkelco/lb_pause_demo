import { describe, it, expect } from "vitest";
import { parseConfig, configFromQueryParams } from "./config.js";

describe("parseConfig", () => {
  it("parses valid string inputs", () => {
    const config = parseConfig({ rps: "100", duration: "10", uri: "http://localhost:8080" });
    expect(config.rps).toBe(100);
    expect(config.durationSec).toBe(10);
    expect(config.uri).toBe("http://localhost:8080/");
    expect(config.threads).toBeGreaterThanOrEqual(1);
  });

  it("parses valid numeric inputs", () => {
    const config = parseConfig({ rps: 50, duration: 5, uri: "http://example.com", threads: 2 });
    expect(config.rps).toBe(50);
    expect(config.durationSec).toBe(5);
    expect(config.threads).toBe(2);
  });

  it("throws when rps is missing", () => {
    expect(() => parseConfig({ duration: "10", uri: "http://localhost" }))
      .toThrow("rps is required");
  });

  it("throws when duration is missing", () => {
    expect(() => parseConfig({ rps: "10", uri: "http://localhost" }))
      .toThrow("duration is required");
  });

  it("throws when uri is missing", () => {
    expect(() => parseConfig({ rps: "10", duration: "10" }))
      .toThrow("uri is required");
  });

  it("throws for invalid rps", () => {
    expect(() => parseConfig({ rps: "0", duration: "10", uri: "http://localhost" }))
      .toThrow("rps must be between");
  });

  it("throws for invalid duration", () => {
    expect(() => parseConfig({ rps: "10", duration: "0", uri: "http://localhost" }))
      .toThrow("duration must be between");
  });

  it("throws for invalid uri", () => {
    expect(() => parseConfig({ rps: "10", duration: "10", uri: "not-a-url" }))
      .toThrow("Invalid URI");
  });

  it("throws for invalid threads", () => {
    expect(() => parseConfig({ rps: "10", duration: "10", uri: "http://localhost", threads: "0" }))
      .toThrow("threads must be a positive integer");
  });

  it("auto-determines threads based on rps", () => {
    const low = parseConfig({ rps: 100, duration: 5, uri: "http://localhost" });
    expect(low.threads).toBe(1);

    const high = parseConfig({ rps: 2000, duration: 5, uri: "http://localhost" });
    expect(high.threads).toBeGreaterThanOrEqual(2);
  });
});

describe("configFromQueryParams", () => {
  it("parses valid query parameters", () => {
    const params = new URLSearchParams("rps=50&duration=10&uri=http://localhost:3000&threads=3");
    const config = configFromQueryParams(params);
    expect(config.rps).toBe(50);
    expect(config.durationSec).toBe(10);
    expect(config.threads).toBe(3);
  });
});
