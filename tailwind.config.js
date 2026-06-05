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
          DEFAULT: '#0fc6c2',
          dark: '#0bada9',
          light: '#e8fafa',
          text: '#0b6e6e',
        },
        bg: '#f7f8fa',
        card: '#ffffff',
        text: {
          DEFAULT: '#1d2129',
          secondary: '#4e5969',
          muted: '#86909c',
        },
        border: '#e5e6eb',
        error: {
          DEFAULT: '#f53f3f',
          bg: '#fff1f0',
        },
        warning: {
          DEFAULT: '#d97b00',
          bg: '#fff7e8',
        },
        success: {
          DEFAULT: '#00b42a',
          bg: '#e8ffea',
        },
      },
    },
  },
  plugins: [],
}
