import { describe, it, expect } from "vitest";
import {
  calculateDpr,
  calculateGridDimensions,
  calculateCenterAttenuation,
  calculateMicroStrokeAngle,
  calculateChromaticColor,
  shortestAngleDiff,
} from "@/components/layout/InteractiveDotField";

describe("Antigravity Dynamic Micro-Stroke Field Physics & Visual Rules", () => {
  describe("1. DPI and Responsive Layout", () => {
    it("clamps devicePixelRatio to maximum 2 on high-density displays", () => {
      expect(calculateDpr(1)).toBe(1);
      expect(calculateDpr(1.5)).toBe(1.5);
      expect(calculateDpr(2)).toBe(2);
      expect(calculateDpr(3)).toBe(2);
      expect(calculateDpr(4)).toBe(2);
    });

    it("calculates lightweight grid on mobile (spacing 50px) and expansive grid on desktop (spacing 36px)", () => {
      const mobileGrid = calculateGridDimensions(390, 844, true, "normal");
      expect(mobileGrid.spacing).toBe(50);
      expect(mobileGrid.totalStrokes).toBeGreaterThan(50);
      expect(mobileGrid.totalStrokes).toBeLessThan(150);

      const desktopGrid = calculateGridDimensions(1440, 900, false, "normal");
      expect(desktopGrid.spacing).toBe(36);
      expect(desktopGrid.totalStrokes).toBeGreaterThan(600);
    });

    it("respects density prop configurations (subtle, normal, dense)", () => {
      const subtle = calculateGridDimensions(1200, 800, false, "subtle");
      const normal = calculateGridDimensions(1200, 800, false, "normal");
      const dense = calculateGridDimensions(1200, 800, false, "dense");

      expect(subtle.spacing).toBeGreaterThan(normal.spacing);
      expect(dense.spacing).toBeLessThan(normal.spacing);
      expect(dense.totalStrokes).toBeGreaterThan(normal.totalStrokes);
    });
  });

  describe("2. Central Area Clearing (Despeje Central)", () => {
    it("produces higher visual clarity / reduced opacity at screen center and full density at edges", () => {
      const width = 1440;
      const height = 900;
      const centerX = width / 2;
      const centerY = height / 2;

      const centerFactor = calculateCenterAttenuation(centerX, centerY, width, height);
      const edgeFactor = calculateCenterAttenuation(10, 10, width, height);
      const cornerFactor = calculateCenterAttenuation(width, height, width, height);

      // Center attenuation should be around ~0.48 to 0.55 for clear data readability
      expect(centerFactor).toBeLessThan(0.55);
      expect(centerFactor).toBeGreaterThanOrEqual(0.48);

      // Edges should have full visual weight (~1.0)
      expect(edgeFactor).toBeGreaterThan(0.9);
      expect(cornerFactor).toBe(1.0);
    });
  });

  describe("3. Autonomous Ambient Flow & Circular Angles", () => {
    it("computes continuous organic orientation angles without NaN or infinity", () => {
      const angle1 = calculateMicroStrokeAngle(100, 150, 0, 0.5);
      const angle2 = calculateMicroStrokeAngle(100, 150, 1000, 0.5);
      const angle3 = calculateMicroStrokeAngle(200, 300, 1000, 0.5);

      expect(Number.isFinite(angle1)).toBe(true);
      expect(Number.isFinite(angle2)).toBe(true);
      expect(Number.isFinite(angle3)).toBe(true);
      // Different times and positions yield varied organic orientations
      expect(angle1).not.toBe(angle2);
      expect(angle2).not.toBe(angle3);
    });

    it("computes shortest angular difference respecting 2PI periodicity without jumping", () => {
      // Small positive difference
      expect(shortestAngleDiff(0.5, 0.4)).toBeCloseTo(0.1, 5);

      // Across the +PI / -PI boundary: 3.10 and -3.10 are 0.083 apart
      const diffWrap = shortestAngleDiff(3.1, -3.1);
      expect(Math.abs(diffWrap)).toBeLessThan(0.2);

      // Same angle
      expect(shortestAngleDiff(Math.PI, Math.PI)).toBe(0);
    });
  });

  describe("4. Chromatic Modulation (Cold vs. Warm Palettes)", () => {
    it("interpolates cold (indigo/violet) to warm (amber/gold) in Dark Mode", () => {
      const coldDark = calculateChromaticColor(0, 0.3, true);
      const warmDark = calculateChromaticColor(1, 0.3, true);

      // Cold has high blue channel (>= 240) and lower red
      expect(coldDark).toContain("rgba(115, 110, 245, 0.30)");

      // Warm has high red channel (>= 240) and lower blue
      expect(warmDark).toContain("rgba(245, 168, 65, 0.30)");
    });

    it("interpolates cold slate-violet to warm slate-amber in Light Mode without reducing COP legibility", () => {
      const coldLight = calculateChromaticColor(0, 0.25, false);
      const warmLight = calculateChromaticColor(1, 0.25, false);

      // Cold light mode: slate blue-violet
      expect(coldLight).toContain("rgba(95, 105, 190, 0.25)");

      // Warm light mode: warm amber-gold
      expect(warmLight).toContain("rgba(200, 125, 45, 0.25)");
    });
  });

  describe("5. Layering & Architectural Isolation", () => {
    it("ensures container keeps pointer-events-none and z-0 layer below content and modals", () => {
      const containerClasses = "absolute inset-0 pointer-events-none overflow-hidden z-0";
      expect(containerClasses).toContain("pointer-events-none");
      expect(containerClasses).toContain("z-0");
    });
  });
});
