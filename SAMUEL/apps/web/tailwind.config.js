/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg)',
        surface: 'var(--surface)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
        },
        route: 'var(--route)',
        brand: {
          50: 'var(--surface-2)',
          100: 'var(--surface-2)',
          200: 'var(--border-strong)',
          300: 'var(--muted)',
          500: 'var(--accent)',
          600: 'var(--accent)',
          700: 'var(--accent-hover)',
          800: 'var(--muted)',
          900: 'var(--ink)',
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
