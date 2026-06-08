import { describe, expect, it } from "vitest";
import { requireEnv } from "./env";

describe("requireEnv", () => {
  it("returns the value when set", () => {
    process.env.LANTERN_TEST_VAR = "hello";
    expect(requireEnv("LANTERN_TEST_VAR")).toBe("hello");
  });
  it("throws a named error when missing", () => {
    delete process.env.LANTERN_TEST_MISSING;
    expect(() => requireEnv("LANTERN_TEST_MISSING")).toThrow("LANTERN_TEST_MISSING");
  });
});
