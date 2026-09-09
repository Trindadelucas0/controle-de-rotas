/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#121212',
        surface: '#1C1C1E',
        accent: {
          DEFAULT: '#FF5722',
          hover: '#E64A19',
        },
        route: '#2EE6C7',
        brand: {
          50: '#242426',
          100: '#2c2c2e',
          200: '#3a3a3c',
          300: '#48484a',
          500: '#FF5722',
          600: '#FF5722',
          700: '#E64A19',
          800: '#c8c8ca',
          900: '#f2f2f4',
        },
      },
      fontFamily: {
        sans: ['Overpass', 'Segoe UI', 'sans-serif'],
        display: ['Overpass', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        xl: '8px',
        '2xl': '10px',
      },
    },
  },
  plugins: [],
};
