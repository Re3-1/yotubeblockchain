/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1F3A68", light: "#3B82F6" },
      },
    },
  },
  plugins: [],
};
