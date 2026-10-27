import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        muted: "var(--muted)",
        secondary: "var(--secondary)",
        separator: "var(--separator)",
        accent: "var(--accent)",
        success: "var(--success)",
        "success-text": "var(--success-text)",
        "accent-soft": "var(--accent-soft)",
        "danger-text": "var(--danger-text)",
        "danger-soft": "var(--danger-soft)",
        "warning-text": "var(--warning-text)",
        "warning-soft": "var(--warning-soft)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "SF Pro Display", "Segoe UI", "sans-serif"],
        display: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 2px 12px rgba(0, 0, 0, 0.025)",
      },
    },
  },
  plugins: [],
};

export default config;
