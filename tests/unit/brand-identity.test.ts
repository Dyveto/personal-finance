import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import manifest from "@/app/manifest";

describe("Official Brand Identity, Assets & PWA Verification", () => {
  const rootDir = path.resolve(__dirname, "../../");

  const requiredAssets = [
    "public/icon-192.png",
    "public/icon-512.png",
    "public/apple-touch-icon.png",
    "public/favicon.ico",
    "public/favicon-32x32.png",
    "public/favicon-16x16.png",
    "public/brand/logo.jpg",
    "public/brand/app-icon.jpg",
    "public/brand/app-icon-cropped.png",
    "public/manifest.json",
    "src/app/icon.png",
    "src/app/apple-icon.png",
  ];

  it.each(requiredAssets)("verifies that %s exists and is not empty", (relPath) => {
    const fullPath = path.join(rootDir, relPath);
    expect(fs.existsSync(fullPath)).toBe(true);
    const stats = fs.statSync(fullPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it("verifies manifest.ts specifies dark navy theme color and valid icons", () => {
    const manifestData = manifest();
    expect(manifestData.theme_color).toBe("#0B0F19");
    expect(manifestData.background_color).toBe("#0B0F19");
    expect(manifestData.name).toContain("Personal Finance");
    expect(manifestData.icons).toBeDefined();
    expect(manifestData.icons?.length).toBeGreaterThanOrEqual(2);

    const iconSrcs = manifestData.icons?.map((i) => i.src) || [];
    expect(iconSrcs).toContain("/icon-192.png");
    expect(iconSrcs).toContain("/icon-512.png");
  });

  it("verifies public/manifest.json matches PWA specifications and is valid JSON", () => {
    const jsonPath = path.join(rootDir, "public/manifest.json");
    const content = fs.readFileSync(jsonPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed.name).toContain("Personal Finance");
    expect(parsed.theme_color).toBe("#0B0F19");
    expect(parsed.background_color).toBe("#0B0F19");
    expect(parsed.icons).toHaveLength(2);
    expect(parsed.icons[0].src).toBe("/icon-192.png");
    expect(parsed.icons[1].src).toBe("/icon-512.png");
  });
});
