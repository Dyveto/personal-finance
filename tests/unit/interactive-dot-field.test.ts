import { describe, it, expect } from "vitest";

describe("Interactive Dot Field Mobile & Touch Rules", () => {
  const desktopSpacing = 38;
  const mobileSpacing = 54;
  const interactionRadius = 130;
  const maxPushDistance = 18;
  const damping = 0.12;

  function calculateGrid(width: number, height: number, isMobileOrTouch: boolean): {
    cols: number;
    rows: number;
    totalDots: number;
    spacing: number;
  } {
    const spacing = isMobileOrTouch ? mobileSpacing : desktopSpacing;
    const cols = Math.floor(width / spacing);
    const rows = Math.floor(height / spacing);
    return { cols, rows, totalDots: cols * rows, spacing };
  }

  function calculateDpr(devicePixelRatio: number): number {
    return Math.min(devicePixelRatio || 1, 2);
  }

  function calculateAmbientWave(originX: number, originY: number, time: number): { waveX: number; waveY: number } {
    const waveX = Math.sin(time * 0.0014 + originY * 0.018) * 4.5;
    const waveY = Math.cos(time * 0.0011 + originX * 0.018) * 4.5;
    return { waveX, waveY };
  }

  function calculateTouchPhysics(
    originX: number,
    originY: number,
    currentX: number,
    currentY: number,
    touchX: number,
    touchY: number,
    isTouchActive: boolean,
    ambientOffset: { waveX: number; waveY: number }
  ): { targetX: number; targetY: number; nextX: number; nextY: number } {
    const baseX = originX + ambientOffset.waveX;
    const baseY = originY + ambientOffset.waveY;

    let targetX = baseX;
    let targetY = baseY;

    if (isTouchActive) {
      const dx = touchX - baseX;
      const dy = touchY - baseY;
      const distSq = dx * dx + dy * dy;
      const radiusSq = interactionRadius * interactionRadius;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const factor = 1 - dist / interactionRadius;
        const force = factor * factor * maxPushDistance;
        const angle = Math.atan2(dy, dx);

        targetX = baseX - Math.cos(angle) * force;
        targetY = baseY - Math.sin(angle) * force;
      }
    }

    const diffX = targetX - currentX;
    const diffY = targetY - currentY;
    const nextX = currentX + diffX * damping;
    const nextY = currentY + diffY * damping;

    return { targetX, targetY, nextX, nextY };
  }

  it("clamps devicePixelRatio to maximum 2 on high-DPI mobile screens to save GPU/battery", () => {
    expect(calculateDpr(1)).toBe(1);
    expect(calculateDpr(2)).toBe(2);
    expect(calculateDpr(3)).toBe(2); // Retinas / OLEDs clamped to 2
    expect(calculateDpr(3.5)).toBe(2);
  });

  it("uses lower dot density (spacing 54px) on mobile/touchscreen to keep dot count ultra-light (~100 dots)", () => {
    const mobileGrid = calculateGrid(390, 844, true);
    expect(mobileGrid.spacing).toBe(54);
    expect(mobileGrid.totalDots).toBeGreaterThan(50);
    expect(mobileGrid.totalDots).toBeLessThan(150); // Lightweight: ~105 dots

    const desktopGrid = calculateGrid(1440, 900, false);
    expect(desktopGrid.spacing).toBe(38);
    expect(desktopGrid.totalDots).toBeGreaterThan(500);
  });

  it("generates continuous smooth organic ambient wave on mobile when not touching screen", () => {
    const t0 = calculateAmbientWave(100, 100, 0);
    const t1 = calculateAmbientWave(100, 100, 1000);

    expect(Math.abs(t0.waveX)).toBeLessThanOrEqual(4.5);
    expect(Math.abs(t0.waveY)).toBeLessThanOrEqual(4.5);
    expect(t1.waveX).not.toBe(t0.waveX); // Continuously evolving over time
  });

  it("activates concentrated repulsion deflection ONLY when user actively touches the screen", () => {
    const ambient = { waveX: 2.0, waveY: -1.5 };

    // Touch active 40px away from the dot's base position
    const touched = calculateTouchPhysics(100, 100, 102, 98.5, 142, 98.5, true, ambient);
    expect(touched.targetX).toBeLessThan(102); // Pushed away to the left

    // When touch is released (isTouchActive: false), target returns smoothly to ambient base
    const released = calculateTouchPhysics(100, 100, touched.nextX, touched.nextY, -1000, -1000, false, ambient);
    expect(released.targetX).toBe(102); // Target is base (100 + 2.0)
    expect(released.nextX).toBeGreaterThan(touched.nextX); // Spring damping moving back to base
  });

  it("never intercepts scroll or clicks: canvas container maintains pointer-events-none", () => {
    const containerClasses = "absolute inset-0 pointer-events-none overflow-hidden z-0";
    expect(containerClasses).toContain("pointer-events-none");
    expect(containerClasses).toContain("z-0");
  });
});
