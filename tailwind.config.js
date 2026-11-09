/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#080810', 2: '#11111D', 3: '#181828', 4: '#22223A' },
        primary: v('primary'),
        secondary: v('secondary'),
        magenta: v('magenta'),
        cyan: v('cyan'),
      },
      fontFamily: {
        display: ['Unbounded', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -6px rgb(var(--c-primary) / 0.6)',
        'glow-lg': '0 0 80px -10px rgb(var(--c-primary) / 0.75), 0 0 30px -10px rgb(var(--c-magenta) / 0.6)',
      },
    },
  },
  plugins: [],
};
