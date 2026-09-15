/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          deep: '#1a1433',
          dusk: '#2a2150',
          mist: '#3d3470',
        },
        gold: {
          soft: '#d4b06a',
          warm: '#c9a227',
          bright: '#f0d78c',
        },
        cream: '#f7f1e8',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(212, 176, 106, 0.15)',
      },
    },
  },
  plugins: [],
}
