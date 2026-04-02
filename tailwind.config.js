/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        grass: {
          0: "var(--grass-0)",
          1: "var(--grass-1)",
          2: "var(--grass-2)",
          3: "var(--grass-3)",
          4: "var(--grass-4)",
        },
      },
    },
  },
  plugins: [],
};
