/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#A7F3D0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#065F46',
          600: '#054035',
          700: '#042e27',
          800: '#031f1a',
          900: '#021410',
        },
        mint: '#A7F3D0',
        cream: '#FFF8E7',
      }
    }
  },
  plugins: []
}
