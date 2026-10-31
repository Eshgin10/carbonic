/** @type {import('tailwindcss').Config} */
// Palette from the Caleo style guide: lime #DCFF00, olive #292C0A, stone #AFB8B4, coal #131313.
// Older semantic names (forest, mint, paper) map onto it so shared components stay consistent.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lime: { DEFAULT: '#DCFF00', 600: '#B8D600', 700: '#8FA600', 100: '#F4FFC2' },
        olive: '#292C0A',
        stone: '#AFB8B4',
        coal: '#131313',
        ink: '#131313',
        forest: { 900: '#292C0A', 700: '#292C0A', 500: '#8FA600' },
        mint: { 300: '#DCFF00', 100: '#F4FFC2' },
        paper: '#E7EBE9',
        line: '#D6DBD8',
        muted: '#5E6662',
        amber: '#C8902B',
        graphite: '#131313',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '24px' },
      boxShadow: { card: '0 12px 32px -14px rgba(19,19,19,.18)' },
      transitionTimingFunction: { out: 'cubic-bezier(.22,1,.36,1)' },
    },
  },
  plugins: [],
};
