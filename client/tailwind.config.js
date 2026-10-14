/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        aegis: {
          bg: '#050505',
          surface: '#111111',
          surfaceLight: '#181818',
          border: '#222222',
          borderLight: '#333333',
          orange: '#E85D04',
          orangeDark: '#A83A00',
          orangeGlow: 'rgba(232, 93, 4, 0.15)',
          white: '#F5F2EA',
          muted: '#9B9891',
          mutedDark: '#66635D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
