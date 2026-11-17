import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Plus Jakarta Sans'", "sans-serif"],
        sans: ["'Outfit'", "sans-serif"],
      },
      colors: {
        // DESIGN.md Palette
        canvas: "#0B0F19",
        surface: {
          DEFAULT: "#131B2E",
          hover: "#1A243D",
          border: "rgba(255, 255, 255, 0.08)",
        },
        accent: {
          DEFAULT: "#8B5CF6",
          hover: "#7C3AED",
          glow: "rgba(139, 92, 246, 0.25)",
        },
        income: {
          DEFAULT: "#10B981",
          subtle: "rgba(16, 185, 129, 0.12)",
        },
        expense: {
          DEFAULT: "#F43F5E",
          subtle: "rgba(244, 63, 94, 0.12)",
        },
        border: "rgba(255, 255, 255, 0.08)",
        input: "rgba(255, 255, 255, 0.08)",
        ring: "#8B5CF6",
        background: "#0B0F19",
        foreground: "#F8FAFC",
        primary: {
          DEFAULT: "#8B5CF6",
          foreground: "#F8FAFC",
        },
        secondary: {
          DEFAULT: "#131B2E",
          foreground: "#F8FAFC",
        },
        destructive: {
          DEFAULT: "#F43F5E",
          foreground: "#F8FAFC",
        },
        muted: {
          DEFAULT: "rgba(255, 255, 255, 0.05)",
          foreground: "#94A3B8",
        },
        popover: {
          DEFAULT: "#131B2E",
          foreground: "#F8FAFC",
        },
        card: {
          DEFAULT: "#131B2E",
          foreground: "#F8FAFC",
        },
      },
      borderRadius: {
        "2xl": "1rem", // 16px - Cards principales (DESIGN.md)
        xl: "0.75rem", // 12px - Botones e Inputs (DESIGN.md)
        full: "9999px", // Badges y píldoras
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
