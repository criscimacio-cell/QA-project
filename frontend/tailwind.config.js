/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#C4B5FD',
          300: '#a78bfa',
          400: '#8B5CF6',
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#1E1B4B',
        },
        lavender: '#C4B5FD',
        indigo: '#1E1B4B',
      }
    }
  },
  plugins: []
}
