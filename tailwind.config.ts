import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090A0F',
        foreground: '#F3F4F6',
        cyber: {
          blue: '#0070BA', // Official PayPal Classic Blue
          sky: '#003087',  // Official PayPal Deep Navy
          neon: '#00CFDE', // PayPal Bright Accent
          gold: '#FFC439', // PayPal Button Gold
          card: '#111420',
          border: '#1E2438'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
};

export default config;
