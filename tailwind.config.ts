import type { Config } from 'tailwindcss'
export default {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#0a0f14', panel: '#11181f', line: '#1f2a33', muted: '#8b98a5' } } },
  plugins: [],
} satisfies Config
