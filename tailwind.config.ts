import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        command: {
          900: "#06111b",
          800: "#0b1f31",
          700: "#11344f",
          500: "#24739f",
          300: "#58b8d6"
        },
        alert: {
          high: "#ff5a40",
          medium: "#f2ae2e",
          low: "#23a87b"
        }
      },
      boxShadow: {
        panel: "0 10px 35px rgba(0, 0, 0, 0.32)",
        glow: "0 0 0 1px rgba(72, 170, 204, 0.45), 0 10px 30px rgba(4, 20, 32, 0.5)"
      },
      backgroundImage: {
        "tactical-grid": "linear-gradient(rgba(74, 163, 201, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(74, 163, 201, 0.08) 1px, transparent 1px)"
      },
      backgroundSize: {
        grid: "36px 36px"
      }
    }
  },
  plugins: []
};

export default config;
