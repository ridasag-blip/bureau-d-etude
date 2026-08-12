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
          DEFAULT: "#5BAE46",
          dark: "#478A37",
          light: "#EBF5E8",
        },
        isoRed: {
          DEFAULT: "#C7070A",
          dark: "#960508",
          light: "#FCEAEA",
        },
        isoGold: "#D4A017",
        isoNavy: "#1B6FAF",
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
