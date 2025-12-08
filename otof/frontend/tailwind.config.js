/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0f766e',
        secondary: '#0ea5e9',
        accent: '#f59e0b'
      },
      boxShadow: {
        soft: '0 10px 40px rgba(15, 118, 110, 0.08)'
      }
    }
  },
  plugins: []
};
