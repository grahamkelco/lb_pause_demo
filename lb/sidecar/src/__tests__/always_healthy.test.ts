import { describe, it, expect } from "vitest";
import { AlwaysHealthy } from "../always_healthy.js";

describe("AlwaysHealthy", () => {
  it("always reports healthy", () => {
    const check = new AlwaysHealthy();
    expect(check.isHealthy()).toBe(true);
  });

  it("returns a positive drain interval", () => {
    const check = new AlwaysHealthy();
    expect(check.getDrainInterval()).toBe(200);
  });
});
