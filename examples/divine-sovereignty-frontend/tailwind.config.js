/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          950: '#08051B',
          900: '#120B36',
          800: '#1D1452',
        },
        gold: {
          200: '#F3DFA2',
          300: '#E8C573',
          400: '#DDA84A',
        },
      },
      fontFamily: {
        heading: ['"Cormorant Garamond"', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        aura: '0 20px 60px rgba(21, 11, 59, 0.5)',
      },
    },
  },
  plugins: [],
}
