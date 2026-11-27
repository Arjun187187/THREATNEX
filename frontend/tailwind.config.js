/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        soc: {
          base: "#080C14",
          surface: "#0D1526",
          card: "#111C33",
          cardHover: "#162340",
          border: "#1E2E4E",
          borderSubtle: "#16233B",
          borderLight: "#2A3F6A",
          accent: "#0EA5E9",
          accentHover: "#38BDF8",
          cyan: "#06B6D4",
          emerald: "#10B981",
          amber: "#F59E0B",
          orange: "#F97316",
          rose: "#F43F5E",
          crimson: "#EF4444",
          muted: "#94A3B8",
          text: "#F1F5F9",
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'soc-subtle': '0 2px 8px -2px rgba(2, 6, 23, 0.5), 0 1px 4px -1px rgba(2, 6, 23, 0.4)',
        'soc-card': '0 4px 16px -4px rgba(2, 6, 23, 0.6), 0 2px 6px -2px rgba(2, 6, 23, 0.4)',
        'soc-elevated': '0 12px 32px -8px rgba(2, 6, 23, 0.8), 0 4px 12px -2px rgba(2, 6, 23, 0.5)',
      }
    },
  },
  plugins: [],
}
