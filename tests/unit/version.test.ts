import { describe, it, expect } from "vitest";
import packageJson from "../../package.json";
import { APP_VERSION } from "../../src/config/version";

describe("Version Consistency and SemVer Protocol", () => {
  it("should match APP_VERSION with package.json version", () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });

  it("should comply with Semantic Versioning format (MAJOR.MINOR.PATCH)", () => {
    const semVerRegex = /^\d+\.\d+\.\d+$/;
    expect(APP_VERSION).toMatch(semVerRegex);
    expect(packageJson.version).toMatch(semVerRegex);
  });

  it("should be at least version 1.4.0", () => {
    const [major, minor] = APP_VERSION.split(".").map(Number);
    expect(major).toBeGreaterThanOrEqual(1);
    if (major === 1) {
      expect(minor).toBeGreaterThanOrEqual(4);
    }
  });
});
