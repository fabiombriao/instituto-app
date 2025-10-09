import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f8ff",
          100: "#e9f0ff",
          200: "#c7d9ff",
          300: "#9bbaff",
          400: "#6b95ff",
          500: "#3c6fff",
          600: "#2252db",
          700: "#1a3fb0",
          800: "#193996",
          900: "#182f76"
        },
        success: "#22c55e",
        warning: "#f97316",
        danger: "#ef4444"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
};

export default config;
