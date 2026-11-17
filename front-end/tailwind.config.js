/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tg: {
          dark: '#0e1621',
          darker: '#0a0e14',
          panel: '#17212b',
          border: '#242f3d',
          accent: '#2aabee',
          accentHover: '#229ad6',
          bubbleIn: '#182533',
          bubbleOut: '#2b5278',
          text: '#ffffff',
          textMuted: '#7f91a4',
          gold: '#d4af37',
          goldLight: '#f3c853',
          goldDark: '#997d26',
          goldBubbleOut: '#2d250e',
          goldBorder: '#3d3215'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
