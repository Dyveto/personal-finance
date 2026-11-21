import { describe, it, expect } from "vitest";

describe("Interactive Dot Field Physics & Performance Rules", () => {
  const gridSpacing = 38;
  const interactionRadius = 130;
  const maxPushDistance = 18;
  const damping = 0.12;

  function calculateGrid(width: number, height: number): { cols: number; rows: number; totalDots: number } {
    if (width < 768) {
      return { cols: 0, rows: 0, totalDots: 0 };
    }
    const cols = Math.floor(width / gridSpacing);
    const rows = Math.floor(height / gridSpacing);
    return { cols, rows, totalDots: cols * rows };
  }

  function calculateDpr(devicePixelRatio: number): number {
    return Math.min(devicePixelRatio || 1, 2);
  }

  function calculateDotPhysics(
    originX: number,
    originY: number,
    currentX: number,
    currentY: number,
    mouseX: number,
    mouseY: number,
    mouseActive: boolean
  ): { targetX: number; targetY: number; nextX: number; nextY: number; isSettled: boolean } {
    let targetX = originX;
    let targetY = originY;

    if (mouseActive) {
      const dx = mouseX - originX;
      const dy = mouseY - originY;
      const distSq = dx * dx + dy * dy;
      const radiusSq = interactionRadius * interactionRadius;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const factor = 1 - dist / interactionRadius;
        const force = factor * factor * maxPushDistance;
        const angle = Math.atan2(dy, dx);

        targetX = originX - Math.cos(angle) * force;
        targetY = originY - Math.sin(angle) * force;
      }
    }

    const diffX = targetX - currentX;
    const diffY = targetY - currentY;
    const nextX = currentX + diffX * damping;
    const nextY = currentY + diffY * damping;

    const isSettled = Math.abs(diffX) <= 0.04 && Math.abs(diffY) <= 0.04;

    return { targetX, targetY, nextX, nextY, isSettled };
  }

  it("clamps high-density devicePixelRatio to maximum 2 to protect GPU/memory", () => {
    expect(calculateDpr(1)).toBe(1);
    expect(calculateDpr(1.5)).toBe(1.5);
    expect(calculateDpr(2)).toBe(2);
    expect(calculateDpr(3)).toBe(2); // Retinas / 4k displays clamped to 2
    expect(calculateDpr(4)).toBe(2);
  });

  it("disables particles on mobile screens (< 768px) for battery and CPU conservation", () => {
    const mobile = calculateGrid(390, 844);
    expect(mobile.totalDots).toBe(0);

    const tabletSmall = calculateGrid(767, 1024);
    expect(tabletSmall.totalDots).toBe(0);

    const desktop = calculateGrid(1440, 900);
    expect(desktop.totalDots).toBeGreaterThan(500);
  });

  it("leaves dots at equilibrium origin when mouse is outside interaction radius", () => {
    const dot = calculateDotPhysics(200, 200, 200, 200, 500, 500, true);
    expect(dot.targetX).toBe(200);
    expect(dot.targetY).toBe(200);
    expect(dot.nextX).toBe(200);
    expect(dot.nextY).toBe(200);
    expect(dot.isSettled).toBe(true);
  });

  it("gently deflects dot away from cursor with quadratic falloff when mouse is nearby", () => {
    // Mouse 50px away from dot (inside 130px interaction radius)
    const dot = calculateDotPhysics(200, 200, 200, 200, 250, 200, true);

    // Mouse is to the right (+X), so dot target should be pushed to the left (-X)
    expect(dot.targetX).toBeLessThan(200);
    expect(dot.targetY).toBeCloseTo(200, 1);
    expect(dot.isSettled).toBe(false);

    // Next position moves towards target using damping
    expect(dot.nextX).toBeLessThan(200);
  });

  it("smoothly springs dot back to origin when mouse becomes inactive or leaves window", () => {
    // Dot currently at deflected position (190, 200), mouse inactive
    const dot = calculateDotPhysics(200, 200, 190, 200, -1000, -1000, false);

    expect(dot.targetX).toBe(200);
    expect(dot.targetY).toBe(200);
    // Next position moves from 190 towards 200: 190 + (200 - 190) * 0.12 = 191.2
    expect(dot.nextX).toBeCloseTo(191.2, 1);
  });

  it("detects settled equilibrium state for automatic RAF sleep", () => {
    // Dot already very close to origin (diff < 0.04)
    const dot = calculateDotPhysics(200, 200, 199.98, 200, -1000, -1000, false);
    expect(dot.isSettled).toBe(true);
  });
});
