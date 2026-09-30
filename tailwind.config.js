/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17252d",
        muted: "#718089",
        canvas: "#f4f7f6",
        brand: {
          50: "#eaf7f3",
          100: "#d2eee5",
          500: "#16876c",
          600: "#0f7059",
          700: "#0a5947",
        },
      },
      boxShadow: {
        panel: "0 8px 30px rgba(23, 37, 45, 0.055)",
      },
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
