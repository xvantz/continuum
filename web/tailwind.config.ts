import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{svelte,ts,js}'],
  theme: {
    extend: {
      colors: {
        space: {
          dark: '#050816'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
