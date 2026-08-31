/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        isoGreen: {
          DEFAULT: "#3CD64A",
          dark: "#2BAE3A",
          light: "#E6FBE8",
        },
        isoRed: {
          DEFAULT: "#FF2D3A",
          dark: "#D6101D",
          light: "#FFE8E9",
        },
        isoGold: "#FFB800",
        isoNavy: "#0E8FE0",
        ink: "#16211B",
        paper: "#F7F8F5",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,33,27,0.06), 0 4px 12px rgba(22,33,27,0.05)",
      },
    },
  },
  plugins: [],
};
