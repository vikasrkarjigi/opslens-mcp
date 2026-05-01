/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light premium palette: soft, warm, modern SaaS.
        bg: "#f7f8fc",       // page background (warm off-white)
        panel: "#ffffff",    // card surface
        panel2: "#f1f5fb",   // sub-row / muted surface
        border: "#e4e8f0",   // hairline borders
        ink: "#0f172a",      // primary text (slate-900)
        muted: "#64748b",    // secondary text (slate-500)
        accent: "#4f46e5",   // indigo-600 (primary action)
        ok: "#10b981",       // emerald-500
        warn: "#f59e0b",     // amber-500
        danger: "#ef4444",   // red-500
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        // Soft elevations for premium light cards.
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px -4px rgba(15,23,42,0.08)",
        cardHover: "0 2px 4px rgba(15,23,42,0.06), 0 12px 32px -8px rgba(15,23,42,0.12)",
        glow: "0 0 0 1px rgba(79,70,229,0.35), 0 12px 36px -8px rgba(79,70,229,0.25)",
      },
      backgroundImage: {
        "page-radial":
          "radial-gradient(1200px 600px at 10% -10%, rgba(79,70,229,0.10), transparent 60%)," +
          "radial-gradient(900px 500px at 110% 0%, rgba(16,185,129,0.08), transparent 55%)," +
          "linear-gradient(180deg, #fbfcff 0%, #f5f7fc 100%)",
      },
      keyframes: {
        flashRed: {
          "0%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.55)", backgroundColor: "rgba(254,226,226,1)" },
          "60%": { boxShadow: "0 0 0 14px rgba(239,68,68,0)", backgroundColor: "rgba(254,242,242,1)" },
          "100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0)", backgroundColor: "rgba(254,242,242,1)" },
        },
      },
      animation: {
        flashRed: "flashRed 1.6s ease-out 1",
      },
    },
  },
  plugins: [],
};
