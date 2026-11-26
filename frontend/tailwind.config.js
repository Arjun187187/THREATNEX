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
          bg: "#0B0F19",
          card: "#111827",
          border: "#1F2937",
          hover: "#1E293B",
          accent: "#06B6D4",
          crimson: "#EF4444",
          amber: "#F59E0B",
          emerald: "#10B981",
        }
      }
    },
  },
  plugins: [],
}
