/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep dark palette - "Obsidian & Amber"
        void: {
          50: '#2a2a2e',
          100: '#222226',
          200: '#1c1c1f',
          300: '#161618',
          400: '#111113',
          500: '#0c0c0d',
        },
        smoke: {
          50: '#a8a8b3',
          100: '#8e8e99',
          200: '#6e6e78',
          300: '#4e4e56',
          400: '#3a3a40',
          500: '#2e2e33',
        },
        cream: {
          50: '#faf9f7',
          100: '#f5f3ef',
          200: '#e8e5de',
          300: '#d4d0c6',
        },
        // Warm amber accent - primary identity
        amber: {
          50: '#fef7e0',
          100: '#fceab3',
          200: '#f9d873',
          300: '#f5c638',
          400: '#e5a91a',
          500: '#c98c0f',
          glow: 'rgba(249, 216, 115, 0.15)',
        },
        // Secondary warm accent
        ember: {
          400: '#f97316',
          500: '#ea580c',
        },
        // Status colors
        jade: {
          400: '#4ade80',
          500: '#22c55e',
          muted: '#22c55e40',
        },
        coral: {
          400: '#f87171',
          500: '#ef4444',
          muted: '#ef444440',
        },
        honey: {
          400: '#fbbf24',
          500: '#f59e0b',
          muted: '#f59e0b40',
        },
      },
      fontFamily: {
        display: ['"Satoshi"', 'system-ui', 'sans-serif'],
        body: ['"Satoshi"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.02em' }],
        'sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
        'base': ['1rem', { lineHeight: '1.6', letterSpacing: '0' }],
        'lg': ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        'xl': ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
        '3xl': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        '4xl': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(249, 216, 115, 0.15)',
        'glow': '0 0 25px -5px rgba(249, 216, 115, 0.2)',
        'glow-lg': '0 0 40px -5px rgba(249, 216, 115, 0.25)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        'card': '0 4px 24px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03)',
        'card-hover': '0 8px 32px -4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(249, 216, 115, 0.1)',
        'elevated': '0 12px 48px -12px rgba(0, 0, 0, 0.7)',
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '14px',
        'xl': '20px',
      },
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
        'gradient-spotlight': 'radial-gradient(ellipse 80% 50% at 50% -20%, var(--tw-gradient-stops))',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'spin-slow': 'spin 1.5s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px -5px rgba(249, 216, 115, 0.2)' },
          '50%': { boxShadow: '0 0 30px -5px rgba(249, 216, 115, 0.35)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
}
