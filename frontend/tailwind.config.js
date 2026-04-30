/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#11141b",
        panel2: "#161a23",
        border: "#222838",
        ink: "#e6e8ee",
        muted: "#8b93a7",
        accent: "#7c5cff",
        ok: "#22c55e",
        warn: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,92,255,0.35), 0 8px 30px rgba(124,92,255,0.15)",
      },
    },
  },
  plugins: [],
};
