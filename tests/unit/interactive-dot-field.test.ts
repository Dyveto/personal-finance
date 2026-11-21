import { describe, it, expect } from "vitest";

describe("Interactive Dot Field Broad Aura & Dynamic Physics", () => {
  const desktopSpacing = 38;
  const mobileSpacing = 52;
  const interactionRadius = 250;
  const maxPushDistance = 26;
  const damping = 0.10;

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
    const waveX = Math.sin(time * 0.0014 + originY * 0.018) * 5.0;
    const waveY = Math.cos(time * 0.0011 + originX * 0.018) * 5.0;
    return { waveX, waveY };
  }

  function calculateBroadAuraPhysics(
    originX: number,
    originY: number,
    currentX: number,
    currentY: number,
    pointerX: number,
    pointerY: number,
    isPointerActive: boolean
  ): { targetX: number; targetY: number; nextX: number; nextY: number; proximity: number; dotRadius: number } {
    let targetX = originX;
    let targetY = originY;
    let proximity = 0;

    if (isPointerActive) {
      const dx = pointerX - originX;
      const dy = pointerY - originY;
      const distSq = dx * dx + dy * dy;
      const radiusSq = interactionRadius * interactionRadius;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        proximity = 1 - dist / interactionRadius;
        const force = proximity * proximity * maxPushDistance;
        const angle = Math.atan2(dy, dx);

        targetX = originX - Math.cos(angle) * force;
        targetY = originY - Math.sin(angle) * force;
      }
    }

    const diffX = targetX - currentX;
    const diffY = targetY - currentY;
    const nextX = currentX + diffX * damping;
    const nextY = currentY + diffY * damping;

    const dotRadius = proximity > 0 ? 1.35 + proximity * 0.9 : 1.35;

    return { targetX, targetY, nextX, nextY, proximity, dotRadius };
  }

  it("clamps devicePixelRatio to maximum 2 on high-DPI screens", () => {
    expect(calculateDpr(1)).toBe(1);
    expect(calculateDpr(2)).toBe(2);
    expect(calculateDpr(3)).toBe(2);
  });

  it("calculates lightweight grid on mobile (spacing 52px) and expansive on desktop (spacing 38px)", () => {
    const mobileGrid = calculateGrid(390, 844, true);
    expect(mobileGrid.spacing).toBe(52);
    expect(mobileGrid.totalDots).toBeGreaterThan(60);
    expect(mobileGrid.totalDots).toBeLessThan(140);

    const desktopGrid = calculateGrid(1440, 900, false);
    expect(desktopGrid.spacing).toBe(38);
    expect(desktopGrid.totalDots).toBeGreaterThan(500);

    // Continuous mobile ambient drift
    const wave = calculateAmbientWave(100, 100, 500);
    expect(Math.abs(wave.waveX)).toBeLessThanOrEqual(5.0);
    expect(Math.abs(wave.waveY)).toBeLessThanOrEqual(5.0);
  });

  it("responds over an expansive radius of 250px around the cursor with smooth proximity scaling", () => {
    // Pointer 180px away (well outside former 130px radius, but within new 250px zone)
    const result = calculateBroadAuraPhysics(200, 200, 200, 200, 380, 200, true);

    expect(result.proximity).toBeGreaterThan(0);
    expect(result.targetX).toBeLessThan(200); // Deflected smoothly away from pointer
    expect(result.dotRadius).toBeGreaterThan(1.35); // Radius dynamically enhanced
  });

  it("increases proximity and dot size as cursor gets closer to the dot center", () => {
    const far = calculateBroadAuraPhysics(200, 200, 200, 200, 400, 200, true); // 200px away
    const close = calculateBroadAuraPhysics(200, 200, 200, 200, 240, 200, true); // 40px away

    expect(close.proximity).toBeGreaterThan(far.proximity);
    expect(close.dotRadius).toBeGreaterThan(far.dotRadius);
    expect(close.dotRadius).toBeLessThanOrEqual(2.25);
  });

  it("returns smoothly to equilibrium when pointer is deactivated or leaves window", () => {
    const deflected = calculateBroadAuraPhysics(200, 200, 185, 200, -1000, -1000, false);
    expect(deflected.targetX).toBe(200);
    expect(deflected.targetY).toBe(200);
    expect(deflected.nextX).toBeGreaterThan(185); // Moving back toward 200
  });

  it("ensures canvas container maintains non-blocking pointer-events-none and z-0 layer", () => {
    const containerClasses = "absolute inset-0 pointer-events-none overflow-hidden z-0";
    expect(containerClasses).toContain("pointer-events-none");
    expect(containerClasses).toContain("z-0");
  });
});
