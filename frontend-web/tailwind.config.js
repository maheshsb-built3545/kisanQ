/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kisan: {
          50: '#f2f9f1',
          100: '#e1f3df',
          200: '#c3e7be',
          300: '#97d490',
          400: '#64ba5c',
          500: '#3f9e36',
          600: '#2f7e27',
          700: '#276422',
          800: '#234f1f',
          900: '#1e421c',
          950: '#0c240b'
        }
      }
    },
  },
  plugins: [],
}
