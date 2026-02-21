/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Japandi Palette
        stone: {
          50: '#FDFCF5',  // The "Paper" White
          100: '#F5F2E8', // Warm Beige
          200: '#E6E2D6', // Stone
          800: '#44403C', // Dark Stone
          900: '#2D2D2D', // Charcoal (Text)
        },
        moss: {
          100: '#E8EFE0', // Pale Leaf
          200: '#D4DCC8', // Light Moss (filled slots)
          500: '#4A5D23', // Deep Moss (Primary)
          600: '#3A4A1C', // Dark Moss (Hover)
        },
        cream: {
          50: '#FDFCF5',
          100: '#F9F7F0',
        }
      },
      fontFamily: {
        serif: ['Merriweather', 'serif'], // For Headings
        sans: ['Inter', 'sans-serif'],    // For UI
      },
      keyframes: {
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'bounce-slow': 'bounce-slow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}