/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        panda: {
          50: '#fff5f2',
          100: '#ffe8e1',
          200: '#ffd0c4',
          300: '#ffaa96',
          400: '#ff7758',
          500: '#ff5a36',
          600: '#e04825',
          700: '#c5381a',
          800: '#9d2d17',
          900: '#7e2817',
        },
        obsidian: {
          950: '#07090d',
          900: '#0b0e14',
          850: '#0f131a',
          800: '#121721',
          750: '#161c28',
          700: '#1b2230',
          600: '#263044',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'glass-glow': '0 0 25px -5px rgba(255, 90, 54, 0.3)',
      },
      backdropBlur: {
        'xs': '2px',
        'glass': '16px',
      }
    },
  },
  plugins: [],
}
