/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkblue: "#1e3a8a",
        royalblue: "#2563eb",
        lightgray: "#f3f4f6",
        cyan: "#06b6d4",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
