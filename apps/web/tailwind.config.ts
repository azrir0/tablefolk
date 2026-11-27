import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        short: { raw: "(max-height: 540px)" },
        touch: { raw: "(pointer: coarse)" },
      },
      colors: {
        oat: {
          50: "#FDFBF7",
          100: "#FAF4EA",
          200: "#F2E6D2",
          300: "#E4D1B5",
        },
        espresso: {
          DEFAULT: "#3B2B26",
          soft: "#665047",
          muted: "#8D756A",
        },
        sage: {
          100: "#E6F2EA",
          300: "#9CC9A8",
          500: "#5A9367",
          700: "#3E6D4B",
        },
        amberwarm: {
          100: "#FEF4DC",
          400: "#EBB354",
          600: "#C58326",
        },
        terracotta: {
          100: "#FBEAE5",
          500: "#D97C5E",
          700: "#A85237",
        },
      },
      fontFamily: {
        display: ["var(--font-fredoka)", "system-ui", "sans-serif"],
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        cozy: "0 8px 24px -6px rgba(74, 49, 34, 0.14), 0 2px 6px -1px rgba(74, 49, 34, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
