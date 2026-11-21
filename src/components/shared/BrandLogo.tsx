"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSubtext?: boolean;
  href?: string;
  priority?: boolean;
}

const sizeConfig = {
  sm: {
    container: "w-9 h-9",
    dimension: 36,
    title: "text-sm",
    subtitle: "text-[10px]",
    gap: "gap-2.5",
  },
  md: {
    container: "w-10 h-10",
    dimension: 40,
    title: "text-base",
    subtitle: "text-[11px]",
    gap: "gap-3",
  },
  lg: {
    container: "w-12 h-12",
    dimension: 48,
    title: "text-lg",
    subtitle: "text-xs",
    gap: "gap-3.5",
  },
  xl: {
    container: "w-16 h-16",
    dimension: 64,
    title: "text-xl",
    subtitle: "text-xs",
    gap: "gap-4",
  },
};

export function BrandLogo({
  variant = "full",
  size = "md",
  className,
  showSubtext = true,
  href,
  priority = false,
}: BrandLogoProps) {
  const currentSize = sizeConfig[size] || sizeConfig.md;

  const content = (
    <div
      className={cn(
        "inline-flex items-center group transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] motion-reduce:transform-none select-none",
        currentSize.gap,
        className
      )}
    >
      {/* Emblema Oficial con Squircle y Resplandor Dorado / Azul Marino */}
      <div
        className={cn(
          "relative flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden shadow-sm transition-all duration-300",
          "border border-amber-500/30 dark:border-amber-400/30",
          "shadow-[0_2px_10px_rgba(212,175,55,0.18)] dark:shadow-[0_0_15px_rgba(212,175,55,0.22)]",
          "bg-[#0B132B]",
          currentSize.container
        )}
      >
        <Image
          src="/brand/app-icon.jpg"
          alt="Personal Finance Logo"
          width={currentSize.dimension}
          height={currentSize.dimension}
          priority={priority}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Borde sutil de brillo dorado sobre la superficie */}
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-amber-400/20 pointer-events-none" />
      </div>

      {/* Tipografía de Identidad Oficial */}
      {variant === "full" && (
        <div className="flex flex-col text-left leading-tight">
          <span
            className={cn(
              "font-heading font-extrabold tracking-tight text-slate-900 dark:text-[#F8FAFC]",
              currentSize.title
            )}
          >
            Personal Finance
          </span>
          {showSubtext && (
            <span
              className={cn(
                "font-semibold tracking-wider uppercase -mt-0.5",
                "text-amber-700 dark:text-[#D4AF37]",
                currentSize.subtitle
              )}
            >
              COP Edition
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}
