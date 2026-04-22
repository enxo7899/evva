import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f2ed",
        paper: "#ffffff",
        ink: {
          DEFAULT: "#111112",
          2: "#3a3a3e",
          3: "#6e6e74",
          4: "#a2a2a8"
        },
        line: "rgba(17,17,18,0.1)",
        "line-soft": "rgba(17,17,18,0.06)",
        accent: {
          DEFAULT: "#b24a1f",
          ink: "#7a2f12",
          soft: "#f2e4dc"
        }
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.02em"
      },
      boxShadow: {
        card: "0 1px 0 rgba(17,17,18,0.04), 0 1px 2px rgba(17,17,18,0.04)",
        raised: "0 24px 48px -28px rgba(17,17,18,0.25)"
      }
    }
  },
  plugins: []
};

export default config;
