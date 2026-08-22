/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#000000',
          900: '#09090b',
          800: '#121215',
          700: '#1c1c21',
          600: '#27272a',
          500: '#3f3f46',
        },
        orange: {
          500: '#ff6600',
          600: '#f97316',
          700: '#ea580c',
          800: '#c2410c',
          900: '#7c2d12',
          950: '#431407',
        },
        brand: {
          500: '#ff6600',
          600: '#f97316',
          700: '#ea580c',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
