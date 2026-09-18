/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg)',
        surface: 'var(--surface)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        muted: {
          DEFAULT: 'var(--surface-2)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: 'var(--destructive)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          foreground: '#ffffff',
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
