/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 自定义一些暗黑色系
        background: "#09090b",
        surface: "#18181b",
        border: "#27272a",
      }
    },
  },
  plugins: [],
}