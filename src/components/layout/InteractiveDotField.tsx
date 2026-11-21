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

    // 1. Preferencia de movimiento reducido
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
    let isTouchOrMobile = false;

    // Rango amplio de influencia inspirado en antigravity.google
    const interactionRadius = 250; // Ampliado de 130 a 250px para onda amplia
    const maxPushDistance = 26; // Desplazamiento elástico orgánico
    const damping = 0.10; // Amortiguación fluida

    const pointer = {
      x: -1000,
      y: -1000,
      active: false,
      isTouch: false,
    };

    let animationFrameId: number | null = null;
    let isLoopRunning = false;
    let idleCounter = 0;
    const MAX_DESKTOP_IDLE_FRAMES = 75; // En escritorio, dormir tras estabilizarse

    // 2. Construir cuadrícula con densidad adaptativa (baja densidad en móvil)
    const buildDotsGrid = () => {
      dots = [];
      isTouchOrMobile =
        width < 768 ||
        (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);

      // Mayor espaciado en móviles (52px) para mantener un conteo ligero (~110 puntos)
      // En escritorio espaciado a 38px
      const gridSpacing = isTouchOrMobile ? 52 : 38;

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

    // 3. Ajustar dimensiones con soporte DPI acotado a máx 2
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      buildDotsGrid();

      if (prefersReducedMotion) {
        renderStatic();
      } else {
        wakeLoop();
      }
    };

    // 4. Render estático (sin animación) para prefers-reduced-motion
    const renderStatic = () => {
      ctx.clearRect(0, 0, width, height);
      if (dots.length === 0) return;

      const isDark = document.documentElement.classList.contains("dark");
      ctx.fillStyle = isDark
        ? "rgba(148, 163, 184, 0.20)"
        : "rgba(100, 116, 139, 0.22)";

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        ctx.beginPath();
        ctx.arc(dot.originX, dot.originY, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // 5. Bucle de renderizado animado con campo amplio y deriva ambiental
    const render = (time: number) => {
      if (!isLoopRunning) return;

      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains("dark");

      let hasActiveMovement = false;

      // Cálculo de onda ambiental para móvil o cuando no haya interacción
      const isAmbientActive = isTouchOrMobile && !prefersReducedMotion;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        // Posición base con deriva ambiental orgánica en móvil
        let baseX = dot.originX;
        let baseY = dot.originY;

        if (isAmbientActive) {
          baseX += Math.sin(time * 0.0014 + dot.originY * 0.018) * 5.0;
          baseY += Math.cos(time * 0.0011 + dot.originX * 0.018) * 5.0;
          hasActiveMovement = true;
        }

        // Interacción concentrada en rango amplio (250px)
        let proximity = 0;

        if (pointer.active) {
          const dx = pointer.x - baseX;
          const dy = pointer.y - baseY;
          const distSq = dx * dx + dy * dy;
          const radiusSq = interactionRadius * interactionRadius;

          if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq);
            proximity = 1 - dist / interactionRadius; // 0 (borde) a 1 (centro)
            // Curva suave de caída de fuerza
            const force = proximity * proximity * maxPushDistance;
            const angle = Math.atan2(dy, dx);

            dot.targetX = baseX - Math.cos(angle) * force;
            dot.targetY = baseY - Math.sin(angle) * force;
          } else {
            dot.targetX = baseX;
            dot.targetY = baseY;
          }
        } else {
          dot.targetX = baseX;
          dot.targetY = baseY;
        }

        const diffX = dot.targetX - dot.currentX;
        const diffY = dot.targetY - dot.currentY;

        dot.currentX += diffX * damping;
        dot.currentY += diffY * damping;

        if (Math.abs(diffX) > 0.03 || Math.abs(diffY) > 0.03) {
          hasActiveMovement = true;
        }

        // Tamaño y opacidad dinámicos según proximidad al cursor
        let dotRadius = 1.35;
        let fillStyle = "";

        if (proximity > 0) {
          dotRadius = 1.35 + proximity * 0.9; // Crece sutilmente de 1.35px a 2.25px
          if (isDark) {
            // Modo noche: violeta vibrante con brillo gradual
            const alpha = 0.20 + proximity * 0.45;
            fillStyle = `rgba(167, 139, 250, ${alpha.toFixed(2)})`;
          } else {
            // Modo día: violeta eléctrico profundo con excelente contraste
            const alpha = 0.22 + proximity * 0.43;
            fillStyle = `rgba(124, 58, 237, ${alpha.toFixed(2)})`;
          }
        } else {
          // Puntos en reposo: claramente visibles pero no invasivos
          fillStyle = isDark
            ? "rgba(148, 163, 184, 0.20)"
            : "rgba(100, 116, 139, 0.22)";
        }

        ctx.beginPath();
        ctx.fillStyle = fillStyle;
        ctx.arc(dot.currentX, dot.currentY, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // En escritorio sin movimiento ambiental: suspender al estabilizarse
      if (!isAmbientActive && !hasActiveMovement && !pointer.active) {
        idleCounter++;
        if (idleCounter > MAX_DESKTOP_IDLE_FRAMES) {
          stopLoop();
          return;
        }
      } else {
        idleCounter = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (isLoopRunning || prefersReducedMotion) return;
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
      if (!isLoopRunning && !prefersReducedMotion) {
        startLoop();
      }
    };

    // 6. Manejo pasivo de interacción con pointer events (mouse + touch)
    const handlePointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
      pointer.isTouch = e.pointerType === "touch";
      wakeLoop();
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      if (e.pointerType === "touch") {
        // En móvil/táctil, solo desplazar puntos si el usuario está activamente tocando la pantalla
        if (pointer.active) {
          pointer.x = clientX;
          pointer.y = clientY;
          wakeLoop();
        }
      } else {
        // En escritorio (mouse), responder al movimiento de proximidad
        if (
          clientX >= -100 &&
          clientX <= width + 100 &&
          clientY >= -100 &&
          clientY <= height + 100
        ) {
          pointer.x = clientX;
          pointer.y = clientY;
          pointer.active = true;
          pointer.isTouch = false;
          wakeLoop();
        } else {
          pointer.active = false;
        }
      }
    };

    const handlePointerUp = () => {
      pointer.active = false;
      pointer.x = -1000;
      pointer.y = -1000;
      wakeLoop();
    };

    // 7. Pausa de batería al cambiar de pestaña o bloquear dispositivo
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        wakeLoop();
      }
    };

    // 8. Observar cambios en el tema claro/oscuro
    const themeObserver = new MutationObserver(() => {
      if (prefersReducedMotion) {
        renderStatic();
      } else {
        wakeLoop();
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // 9. ResizeObserver
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });
      resizeObserver.observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", resizeCanvas, { passive: true });
    }

    // Todos los listeners con { passive: true } garantizan desplazamiento (scroll) nativo 100% fluido
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });
    document.addEventListener("mouseleave", handlePointerUp, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resizeCanvas();

    return () => {
      stopLoop();
      motionQuery.removeEventListener("change", handleMotionChange);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.removeEventListener("mouseleave", handlePointerUp);
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
