/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9f0',
          100: '#dcf0dc',
          200: '#bbe2bc',
          300: '#8ecd90',
          400: '#5aaf5d',
          500: '#3a9040',
          600: '#2b7330',
          700: '#245c29',
          800: '#204a23',
          900: '#1b3d1e',
        },
      },
    },
  },
  plugins: [],
};
