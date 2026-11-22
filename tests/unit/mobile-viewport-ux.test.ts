import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { viewport } from "@/app/layout";

describe("Mobile Viewport, UX & Touch Framing Verification", () => {
  it("enforces stable mobile viewport with no unintended auto-zoom", () => {
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
    expect(viewport.maximumScale).toBe(1);
    expect(viewport.userScalable).toBe(false);
    expect(viewport.viewportFit).toBe("cover");
  });

  it("configures strict overflow-x and overscroll rules in globals.css", () => {
    const globalsCssPath = path.resolve(__dirname, "../../src/app/globals.css");
    const globalsContent = fs.readFileSync(globalsCssPath, "utf-8");

    expect(globalsContent).toContain("overflow-x: hidden;");
    expect(globalsContent).toContain("overscroll-behavior-x: none;");
    expect(globalsContent).toContain("max-width: 100vw;");
  });

  it("configures user-select restriction with mandatory editable exception in globals.css", () => {
    const globalsCssPath = path.resolve(__dirname, "../../src/app/globals.css");
    const globalsContent = fs.readFileSync(globalsCssPath, "utf-8");

    // UI text selection disabled by default
    expect(globalsContent).toContain("user-select: none;");
    expect(globalsContent).toContain("-webkit-user-select: none;");
    expect(globalsContent).toContain("-webkit-touch-callout: none;");

    // Editable elements explicitly allowed
    expect(globalsContent).toContain("user-select: text !important;");
    expect(globalsContent).toContain("-webkit-user-select: text !important;");
    expect(globalsContent).toContain("input,");
    expect(globalsContent).toContain("textarea,");
    expect(globalsContent).toContain('[contenteditable="true"]');
  });

  it("enforces minimum 16px font-size on mobile inputs to prevent iOS Safari auto-zoom", () => {
    const globalsCssPath = path.resolve(__dirname, "../../src/app/globals.css");
    const globalsContent = fs.readFileSync(globalsCssPath, "utf-8");

    expect(globalsContent).toMatch(/@media\s+screen\s+and\s+\(max-width:\s*768px\)/);
    expect(globalsContent).toContain("font-size: 16px !important;");
  });

  it("ensures DashboardShell main area blocks horizontal viewport leakage", () => {
    const shellPath = path.resolve(__dirname, "../../src/components/layout/DashboardShell.tsx");
    const shellContent = fs.readFileSync(shellPath, "utf-8");

    expect(shellContent).toContain("overflow-x-hidden");
    expect(shellContent).toContain("max-w-full");
  });
});
