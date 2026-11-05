/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: 'rgb(var(--rgb-main) / <alpha-value>)',
        deepNavy: 'rgb(var(--rgb-card) / <alpha-value>)',
        elevatedNavy: 'rgb(var(--rgb-elevated) / <alpha-value>)',
        slate: 'rgb(var(--rgb-border) / <alpha-value>)',
        primaryText: 'rgb(var(--rgb-primary) / <alpha-value>)',
        secondaryText: 'rgb(var(--rgb-secondary) / <alpha-value>)',
        correctGreen: '#6AAA64',
        presentYellow: '#C9B458',
        absentGrey: 'rgb(var(--rgb-absent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        btn: '8px',
        card: '12px',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0.5' },
          '40%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-5px)' },
          '40%, 80%': { transform: 'translateX(5px)' },
        },
        bounceShort: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      },
      animation: {
        pop: 'pop 0.15s ease-in-out',
        shake: 'shake 0.4s ease-in-out',
        bounceShort: 'bounceShort 0.6s ease-in-out',
      }
    },
  },
  plugins: [],
}
