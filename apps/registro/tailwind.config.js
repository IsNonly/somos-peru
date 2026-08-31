/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
      colors: {
        brand: {
          red:    '#E8534A',
          dark:   '#1A1A2E',
          gold:   '#C9A84C',
        },
      },
    },
  },
  plugins: [],
}
