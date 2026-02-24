/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'Arial', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#F0EDFC',
          100: '#E2DCFA',
          200: '#C9BEF6',
          300: '#A899F0',
          400: '#8A77E8',
          500: '#6C5CE7',
          600: '#5A4BD1',
          700: '#4A3DB5',
          800: '#3D3299',
          900: '#332A7D',
        },
        accent: {
          blue: '#6C5CE7',
          indigo: '#7C5CFC',
          green: '#00D68F',
          orange: '#FF6B35',
          red: '#FF6B6B',
          gold: '#FFC048',
        },
        surface: {
          DEFAULT: '#F8F9FC',
          card: '#FFFFFF',
          hover: '#F1F5F9',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'sidebar': '-4px 0 24px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};
