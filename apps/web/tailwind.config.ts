import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Strict 3-color palette
        brand: {
          white: '#FFFFFF',
          navy: '#0F172A',
          teal: '#0F766E',
        },
        // Allowed neutral UI shades for borders, surfaces, disabled states
        surface: {
          default: '#FFFFFF',
          subtle: '#F8FAFC',
          border: '#E2E8F0',
          textSecondary: '#64748B',
          disabled: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
