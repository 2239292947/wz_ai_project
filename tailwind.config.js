/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#07BEBF',
          dark: '#059A9B',
          light: '#07BEBF14',
          glow: '#07BEBF26',
        },
        bg: '#f8fafc',
        card: '#ffffff',
        text: {
          DEFAULT: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
        },
        border: '#e2e8f0',
        error: {
          DEFAULT: '#ef4444',
          bg: '#fef2f2',
        },
        warning: {
          DEFAULT: '#f59e0b',
          bg: '#fffbeb',
        },
        success: {
          DEFAULT: '#10b981',
          bg: '#ecfdf5',
        },
        info: {
          DEFAULT: '#3b82f6',
          bg: '#eff6ff',
        },
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'xs': '0 1px 2px #00000005, 0 1px 3px #0000000a',
        'sm': '0 1px 2px #0000000a, 0 1px 3px #0000000f',
        'md': '0 4px 6px -1px #0000000f, 0 2px 4px -2px #0000000f',
        'lg': '0 10px 15px -3px #00000014, 0 4px 6px -4px #0000000f',
        'xl': '0 20px 25px -5px #00000014, 0 8px 10px -6px #0000000a',
        '2xl': '0 25px 50px -12px #00000026',
        'inner': 'inset 0 1px 3px #0000000f',
        'glow': '0 0 0 3px #07BEBF26',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(.34, 1.56, .64, 1)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.4s ease-out',
        'slideUp': 'slideUp 0.5s ease-out',
        'slideDown': 'slideDown 0.4s ease-out',
        'scaleIn': 'fadeInScale 0.3s ease-out',
        'bounceIn': 'bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'gradient': 'gradientShift 4s ease infinite',
        'shimmer': 'shimmer 1.5s ease infinite',
        'borderGlow': 'borderGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px #07BEBF26' },
          '50%': { boxShadow: '0 0 20px #07BEBF26, 0 0 40px #07bebf1a' },
        },
        gradientShift: {
          '0%': { backgroundPosition: '0% center' },
          '50%': { backgroundPosition: '100% center' },
          '100%': { backgroundPosition: '0% center' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: '#07BEBF', boxShadow: '0 0 8px #07BEBF26' },
          '50%': { borderColor: '#059A9B', boxShadow: '0 0 16px #07BEBF26' },
        },
      },
    },
  },
  plugins: [],
}
