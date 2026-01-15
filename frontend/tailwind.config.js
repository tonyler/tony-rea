/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#fffef9',
          100: '#fffcf0',
          200: '#fef9e7',
          300: '#fdf5d9',
        },
        ink: {
          100: '#2d2d2d',
          200: '#1a1a1a',
        },
        accent: {
          yellow: '#FFB84D',
          orange: '#FF8C42',
          pink: '#FF6B9D',
          blue: '#4ECDC4',
          green: '#95E1D3',
        }
      },
      fontFamily: {
        hand: ['"Caveat"', '"Patrick Hand"', 'cursive'],
        sans: ['"Comic Neue"', '"Patrick Hand"', 'system-ui', 'sans-serif'],
        mono: ['"Courier Prime"', 'monospace'],
      },
      backgroundImage: {
        'lined-paper': 'repeating-linear-gradient(0deg, transparent, transparent 31px, #e8e4d8 31px, #e8e4d8 32px)',
        'grid-paper': 'linear-gradient(#e8e4d8 1px, transparent 1px), linear-gradient(90deg, #e8e4d8 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
    },
  },
  plugins: [],
}
