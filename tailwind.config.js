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
          DEFAULT: "#6BC94C",
          dark: "#4F9E37",
          light: "#EEF9E9",
        },
        isoRed: {
          DEFAULT: "#C7070A",
          dark: "#960508",
          light: "#FCEAEA",
        },
        isoGold: "#D4A017",
        isoNavy: "#2571AA",
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
