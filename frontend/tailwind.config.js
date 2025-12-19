/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0f766e', // teal
        secondary: '#0ea5e9', // sky-teal accent
        accent: '#f59e0b',
        sand: {
          50: '#f8f5ef',
          100: '#efe8d9',
          200: '#e3d7bc',
          300: '#d6c7a0',
          400: '#c5b07a'
        },
        brand: {
          ink: '#0b1f2a',
          teal: '#0f766e',
          amber: '#f59e0b',
          sand: '#e3d7bc'
        }
      },
      boxShadow: {
        soft: '0 10px 40px rgba(15, 118, 110, 0.08)'
      }
    }
  },
  plugins: []
};
