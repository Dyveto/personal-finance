"use client";

import { useEffect, useRef } from "react";

export interface MicroStroke {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  angle: number;
  targetAngle: number;
  baseLength: number;
  length: number;
  phase: number;
  speed: number;
  spatialWarmth: number;
}

export interface InteractiveDotFieldProps {
  className?: string;
  density?: "subtle" | "normal" | "dense";
}

// ---------------------------------------------------------------------------
// FUNCIONES PURAS Y MATEMÁTICAS EXPORTADAS PARA PRUEBAS Y AUDITORÍA
// ---------------------------------------------------------------------------

/**
 * Limita el devicePixelRatio a un máximo de 2 para proteger pantallas de alta densidad (Retina/4K).
 */
export function calculateDpr(devicePixelRatio: number): number {
  return Math.min(Math.max(devicePixelRatio || 1, 1), 2);
}

/**
 * Calcula el espaciado y cantidad de trazos según viewport y densidad.
 */
export function calculateGridDimensions(
  width: number,
  height: number,
  isMobileOrTouch: boolean,
  density: "subtle" | "normal" | "dense" = "normal"
): { cols: number; rows: number; totalStrokes: number; spacing: number } {
  let baseSpacing = isMobileOrTouch ? 50 : 36;
  if (density === "subtle") baseSpacing += 10;
  if (density === "dense") baseSpacing -= 6;

  const cols = Math.max(1, Math.floor(width / baseSpacing));
  const rows = Math.max(1, Math.floor(height / baseSpacing));
  return {
    cols,
    rows,
    totalStrokes: cols * rows,
    spacing: baseSpacing,
  };
}

/**
 * Factor de despeje central: atenúa la opacidad y escala de los trazos
 * en la zona central de la pantalla donde habitan las tarjetas financieras y datos clave.
 */
export function calculateCenterAttenuation(
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const centerX = width / 2;
  const centerY = height / 2;
  const dx = x - centerX;
  const dy = y - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY) * 0.55;

  const norm = Math.min(1, dist / (maxRadius || 1));
  // Curva smoothstep entre 0.45 (centro más limpio) y 1.0 (bordes plenos)
  const t = Math.max(0, Math.min(1, norm));
  const smooth = t * t * (3 - 2 * t);
  return 0.48 + 0.52 * smooth;
}

/**
 * Calcula la orientación angular base continua (deriva ambiental orgánica permanente).
 */
export function calculateMicroStrokeAngle(
  x: number,
  y: number,
  time: number,
  phase: number
): number {
  const wave1 = Math.sin(time * 0.00075 + y * 0.0042 + phase);
  const wave2 = Math.cos(time * 0.00062 + x * 0.0038 + phase * 0.5);
  return wave1 * Math.PI * 0.65 + wave2 * Math.PI * 0.35;
}

/**
 * Modulación cromática gradual entre tonos fríos (índigo/violeta/azul cian)
 * y tonos cálidos (ámbar/dorado/coral suave) calibrados para Modo Día y Modo Noche.
 */
export function calculateChromaticColor(
  warmth: number,
  alpha: number,
  isDark: boolean
): string {
  const w = Math.max(0, Math.min(1, warmth));
  const a = Math.max(0, Math.min(1, alpha));

  if (isDark) {
    // Modo Noche:
    // Frío (w=0): Violeta eléctrico / Índigo luminiscente rgb(120, 110, 245)
    // Cálido (w=1): Ámbar dorado / Coral suave rgb(245, 168, 65)
    const r = Math.round(115 + (245 - 115) * w);
    const g = Math.round(110 + (168 - 110) * w);
    const b = Math.round(245 + (65 - 245) * w);
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  } else {
    // Modo Día:
    // Frío (w=0): Pizarra azulado frío con matiz índigo rgb(95, 105, 190)
    // Cálido (w=1): Ámbar ocre elegante rgb(200, 125, 45)
    const r = Math.round(95 + (200 - 95) * w);
    const g = Math.round(105 + (125 - 105) * w);
    const b = Math.round(190 + (45 - 190) * w);
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }
}

/**
 * Diferencia angular mínima considerando la periodicidad circular de 2PI.
 */
export function shortestAngleDiff(target: number, current: number): number {
  const diff = (target - current) % (Math.PI * 2);
  return ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/**
 * Componente de Campo de Micro-trazos Dinámico e Interactivo (Antigravity Style).
 * Totalmente desacoplado, pasivo y con cero interferencia sobre inputs y componentes.
 */
export function InteractiveDotField({
  className = "",
  density = "normal",
}: InteractiveDotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // 1. Detección y respeto de accesibilidad prefers-reduced-motion
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
    let strokes: MicroStroke[] = [];
    let isTouchOrMobile = false;

    // Parámetros de física de interacción amplia
    const interactionRadius = 240; // Radio amplio y envolvente
    const maxPushDistance = 22; // Desplazamiento elástico suave
    const damping = 0.09; // Amortiguación suave
    const angularDamping = 0.08; // Suavizado angular continuo

    const pointer = {
      x: -2000,
      y: -2000,
      active: false,
      isTouch: false,
    };

    let animationFrameId: number | null = null;
    let isLoopRunning = false;

    // 2. Construcción de cuadrícula de micro-trazos con desfase y pesos espaciales
    const buildStrokesGrid = () => {
      strokes = [];
      isTouchOrMobile =
        width < 768 ||
        (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);

      const grid = calculateGridDimensions(width, height, isTouchOrMobile, density);
      const offsetX = (width - grid.cols * grid.spacing) / 2 + grid.spacing / 2;
      const offsetY = (height - grid.rows * grid.spacing) / 2 + grid.spacing / 2;

      for (let i = 0; i < grid.cols; i++) {
        for (let j = 0; j < grid.rows; j++) {
          const ox = offsetX + i * grid.spacing;
          const oy = offsetY + j * grid.spacing;

          // Semilla de fase pseudo-aleatoria pero determinista por celda
          const phase = ((i * 37 + j * 73) % 100) / 100 * Math.PI * 2;
          const speed = 0.85 + (((i * 13 + j * 29) % 30) / 100);

          // Longitud contenida de micro-cápsula (6px a 12px)
          const baseLength = isTouchOrMobile ? 7 : 9.5;

          // Peso de calidez espacial (gradiente diagonal: superior izquierda frío -> inferior derecha cálido)
          const normX = width > 0 ? ox / width : 0.5;
          const normY = height > 0 ? oy / height : 0.5;
          const spatialWarmth = Math.min(1, Math.max(0, normX * 0.55 + normY * 0.45));

          strokes.push({
            originX: ox,
            originY: oy,
            currentX: ox,
            currentY: oy,
            targetX: ox,
            targetY: oy,
            angle: phase,
            targetAngle: phase,
            baseLength,
            length: baseLength,
            phase,
            speed,
            spatialWarmth,
          });
        }
      }
    };

    // 3. Ajuste de dimensiones con DPI acotado
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;

      const dpr = calculateDpr(window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";

      buildStrokesGrid();

      if (prefersReducedMotion) {
        renderStatic();
      } else {
        wakeLoop();
      }
    };

    // 4. Render estático para personas con prefers-reduced-motion
    const renderStatic = () => {
      ctx.clearRect(0, 0, width, height);
      if (strokes.length === 0) return;

      const isDark = document.documentElement.classList.contains("dark");

      for (let i = 0; i < strokes.length; i++) {
        const s = strokes[i];
        const centerFactor = calculateCenterAttenuation(s.originX, s.originY, width, height);
        const strokeColor = calculateChromaticColor(
          s.spatialWarmth,
          (isDark ? 0.22 : 0.20) * centerFactor,
          isDark
        );

        const halfLen = (s.baseLength * centerFactor) / 2;
        const cosA = Math.cos(s.angle);
        const sinA = Math.sin(s.angle);

        ctx.beginPath();
        ctx.moveTo(s.originX - cosA * halfLen, s.originY - sinA * halfLen);
        ctx.lineTo(s.originX + cosA * halfLen, s.originY + sinA * halfLen);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isDark ? 1.2 : 1.3;
        ctx.stroke();
      }
    };

    // 5. Bucle de animación continuo y orgánico (antigravity field)
    const render = (time: number) => {
      if (!isLoopRunning) return;

      ctx.clearRect(0, 0, width, height);
      const isDark = document.documentElement.classList.contains("dark");
      const radiusSq = interactionRadius * interactionRadius;

      for (let i = 0; i < strokes.length; i++) {
        const s = strokes[i];

        // Deriva ambiental perpetua: cada trazo se mueve suavemente en su propia fase
        const tScaled = time * s.speed;
        const baseAngle = calculateMicroStrokeAngle(s.originX, s.originY, tScaled, s.phase);

        // Micro-desplazamiento de corriente suave (3.5px a 5px)
        const ambientDriftX = Math.cos(baseAngle) * 4.2;
        const ambientDriftY = Math.sin(baseAngle) * 4.2;

        const anchorX = s.originX + ambientDriftX;
        const anchorY = s.originY + ambientDriftY;

        let proximity = 0;
        let pointerAngle = 0;

        // Perturbación suave si el puntero está activo (cursor o toque)
        if (pointer.active) {
          const dx = pointer.x - anchorX;
          const dy = pointer.y - anchorY;
          const distSq = dx * dx + dy * dy;

          if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq);
            const linearProx = 1 - dist / interactionRadius;
            // Curva suave cúbica
            proximity = linearProx * linearProx * (3 - 2 * linearProx);

            pointerAngle = Math.atan2(dy, dx);
            const push = proximity * maxPushDistance;

            s.targetX = anchorX - Math.cos(pointerAngle) * push;
            s.targetY = anchorY - Math.sin(pointerAngle) * push;

            // El trazo se orienta tangencialmente al flujo del puntero
            const tangentAngle = pointerAngle + Math.PI / 2;
            s.targetAngle = baseAngle + shortestAngleDiff(tangentAngle, baseAngle) * (proximity * 0.65);
            s.length = s.baseLength * (1 + proximity * 0.4);
          } else {
            s.targetX = anchorX;
            s.targetY = anchorY;
            s.targetAngle = baseAngle;
            s.length = s.baseLength;
          }
        } else {
          s.targetX = anchorX;
          s.targetY = anchorY;
          s.targetAngle = baseAngle;
          s.length = s.baseLength;
        }

        // Integración física elástica (lerp)
        s.currentX += (s.targetX - s.currentX) * damping;
        s.currentY += (s.targetY - s.currentY) * damping;

        // Interpolación angular suave evitando saltos en el límite circular
        const angleDelta = shortestAngleDiff(s.targetAngle, s.angle);
        s.angle += angleDelta * angularDamping;

        // Despeje central: trazos más sutiles y limpios en la zona central
        const centerFactor = calculateCenterAttenuation(s.currentX, s.currentY, width, height);

        // Modulación cromática: calidez espacial base + perturbación dinámica
        const dynamicWarmth = Math.min(1, s.spatialWarmth + proximity * 0.55);

        // Opacidad calibrada para no interferir con las cifras en COP
        const baseAlpha = isDark ? 0.18 : 0.17;
        const activeAlpha = isDark ? 0.38 : 0.32;
        const totalAlpha = (baseAlpha + proximity * activeAlpha) * centerFactor;

        const strokeColor = calculateChromaticColor(dynamicWarmth, totalAlpha, isDark);

        // Dibujar micro-cápsula / segmento fino
        const halfLen = (s.length * centerFactor) / 2;
        const cosA = Math.cos(s.angle);
        const sinA = Math.sin(s.angle);

        const startX = s.currentX - cosA * halfLen;
        const startY = s.currentY - sinA * halfLen;
        const endX = s.currentX + cosA * halfLen;
        const endY = s.currentY + sinA * halfLen;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isDark ? 1.25 : 1.35;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (isLoopRunning || prefersReducedMotion) return;
      isLoopRunning = true;
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
      if (!isLoopRunning && !prefersReducedMotion) {
        startLoop();
      }
    };

    // 6. Manejo pasivo de interacción de puntero (mouse y táctil)
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
        if (pointer.active) {
          pointer.x = clientX;
          pointer.y = clientY;
          wakeLoop();
        }
      } else {
        if (
          clientX >= -120 &&
          clientX <= width + 120 &&
          clientY >= -120 &&
          clientY <= height + 120
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
      pointer.x = -2000;
      pointer.y = -2000;
      wakeLoop();
    };

    // 7. Pausa de renderizado cuando la pestaña pasa a segundo plano
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        wakeLoop();
      }
    };

    // 8. Reaccionar a cambios de tema Día/Noche
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

    // Todos los listeners registrados con { passive: true } para proteger el scroll a 60/120 fps
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
  }, [density]);

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden z-0 ${className}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block pointer-events-none opacity-90 transition-opacity duration-500"
      />
    </div>
  );
}
