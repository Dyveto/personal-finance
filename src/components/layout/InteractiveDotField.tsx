"use client";

import { useEffect, useRef } from "react";

interface Dot {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
}

export function InteractiveDotField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Verificar preferencia de movimiento reducido
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReducedMotion = motionQuery.matches;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      if (prefersReducedMotion) {
        stopLoop();
        renderStatic();
      } else {
        startLoop();
      }
    };
    motionQuery.addEventListener("change", handleMotionChange);

    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    const gridSpacing = 38;
    const interactionRadius = 130;
    const maxPushDistance = 18;
    const damping = 0.12;

    const mouse = {
      x: -1000,
      y: -1000,
      active: false,
    };

    let animationFrameId: number | null = null;
    let isLoopRunning = false;
    let idleCounter = 0;
    const MAX_IDLE_FRAMES = 60; // Suspender animación tras estabilizarse (~1 seg)

    // Inicializar o reconstruir la cuadrícula de puntos
    const buildDotsGrid = () => {
      dots = [];
      // Si la pantalla es móvil (< 768px), evitar saturar CPU
      if (width < 768) return;

      const cols = Math.floor(width / gridSpacing);
      const rows = Math.floor(height / gridSpacing);
      const offsetX = (width - cols * gridSpacing) / 2 + gridSpacing / 2;
      const offsetY = (height - rows * gridSpacing) / 2 + gridSpacing / 2;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const ox = offsetX + i * gridSpacing;
          const oy = offsetY + j * gridSpacing;
          dots.push({
            originX: ox,
            originY: oy,
            currentX: ox,
            currentY: oy,
            targetX: ox,
            targetY: oy,
          });
        }
      }
    };

    // Ajustar dimensiones con soporte DPI acotado a máx 2
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
      ctx.scale(dpr, dpr);

      buildDotsGrid();

      if (prefersReducedMotion || width < 768) {
        renderStatic();
      } else {
        wakeLoop();
      }
    };

    // Render estático para usuarios con movimiento reducido o móviles
    const renderStatic = () => {
      ctx.clearRect(0, 0, width, height);
      if (dots.length === 0) return;

      const isDark = document.documentElement.classList.contains("dark");
      ctx.fillStyle = isDark
        ? "rgba(139, 92, 246, 0.08)"
        : "rgba(100, 116, 139, 0.12)";

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        ctx.beginPath();
        ctx.arc(dot.originX, dot.originY, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Bucle interactivo con amortiguación física y suspensión automática
    const render = () => {
      if (!isLoopRunning) return;

      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains("dark");
      const baseColor = isDark
        ? "rgba(148, 163, 184, 0.10)"
        : "rgba(100, 116, 139, 0.14)";
      const highlightColor = isDark
        ? "rgba(139, 92, 246, 0.32)"
        : "rgba(139, 92, 246, 0.35)";

      let hasActiveMovement = false;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        if (mouse.active) {
          const dx = mouse.x - dot.originX;
          const dy = mouse.y - dot.originY;
          const distSq = dx * dx + dy * dy;
          const radiusSq = interactionRadius * interactionRadius;

          if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq);
            const factor = 1 - dist / interactionRadius;
            const force = factor * factor * maxPushDistance;
            const angle = Math.atan2(dy, dx);

            dot.targetX = dot.originX - Math.cos(angle) * force;
            dot.targetY = dot.originY - Math.sin(angle) * force;
          } else {
            dot.targetX = dot.originX;
            dot.targetY = dot.originY;
          }
        } else {
          dot.targetX = dot.originX;
          dot.targetY = dot.originY;
        }

        const diffX = dot.targetX - dot.currentX;
        const diffY = dot.targetY - dot.currentY;

        dot.currentX += diffX * damping;
        dot.currentY += diffY * damping;

        if (Math.abs(diffX) > 0.04 || Math.abs(diffY) > 0.04) {
          hasActiveMovement = true;
        }

        // Color interactivo sutil
        const distFromOrigin = Math.hypot(
          dot.currentX - dot.originX,
          dot.currentY - dot.originY
        );

        ctx.beginPath();
        if (distFromOrigin > 1.5) {
          ctx.fillStyle = highlightColor;
          ctx.arc(dot.currentX, dot.currentY, 1.4, 0, Math.PI * 2);
        } else {
          ctx.fillStyle = baseColor;
          ctx.arc(dot.currentX, dot.currentY, 1.1, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Si no hay movimiento perceptible ni mouse activo, dormir el loop para ahorrar 100% de CPU
      if (!hasActiveMovement && !mouse.active) {
        idleCounter++;
        if (idleCounter > MAX_IDLE_FRAMES) {
          stopLoop();
          return;
        }
      } else {
        idleCounter = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (isLoopRunning || prefersReducedMotion || width < 768) return;
      isLoopRunning = true;
      idleCounter = 0;
      animationFrameId = requestAnimationFrame(render);
    };

    const stopLoop = () => {
      isLoopRunning = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const wakeLoop = () => {
      idleCounter = 0;
      if (!isLoopRunning && !prefersReducedMotion && width >= 768) {
        startLoop();
      }
    };

    // Eventos de cursor sobre la ventana
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      // Solo activar si está dentro de un rango razonable
      if (
        clientX >= -50 &&
        clientX <= width + 50 &&
        clientY >= -50 &&
        clientY <= height + 50
      ) {
        mouse.x = clientX;
        mouse.y = clientY;
        mouse.active = true;
        wakeLoop();
      } else {
        mouse.active = false;
      }
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
      wakeLoop();
    };

    // Escuchar cambios de visibilidad de la pestaña (ahorro de batería)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        wakeLoop();
      }
    };

    // Observar cambios en el tema claro/oscuro para redibujar de inmediato
    const themeObserver = new MutationObserver(() => {
      if (prefersReducedMotion || width < 768) {
        renderStatic();
      } else {
        wakeLoop();
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // ResizeObserver para ajuste exacto según el contenedor
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });
      resizeObserver.observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", resizeCanvas);
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resizeCanvas();

    return () => {
      stopLoop();
      motionQuery.removeEventListener("change", handleMotionChange);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      themeObserver.disconnect();
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", resizeCanvas);
      }
    };
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block pointer-events-none opacity-90 transition-opacity duration-500"
      />
    </div>
  );
}
