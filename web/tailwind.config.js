import path from 'path';
import { fileURLToPath } from 'url';

// Correctly resolve __dirname in an ES module environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  // Use absolute paths to prevent any issues with spaces in folder names
  content: [
    path.resolve(__dirname, "./index.html"),
    path.resolve(__dirname, "./src/**/*.{js,ts,jsx,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'rgb(var(--color-brand-primary) / <alpha-value>)',
          success: 'rgb(var(--color-brand-success) / <alpha-value>)',
          warning: 'rgb(var(--color-brand-warning) / <alpha-value>)',
          danger: 'rgb(var(--color-brand-danger) / <alpha-value>)',
        },
        surface: {
          light: 'rgb(var(--color-surface-light) / <alpha-value>)',
          dark: 'rgb(var(--color-surface-dark) / <alpha-value>)',
          card: 'rgb(var(--color-surface-card) / <alpha-value>)',
        },
        text: {
          DEFAULT: 'rgb(var(--color-text-default) / <alpha-value>)',
          light: 'rgb(var(--color-text-light) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          'muted-dark': 'rgb(var(--color-text-muted-dark) / <alpha-value>)',
        },
        border: {
          light: 'rgb(var(--color-border-light) / <alpha-value>)',
          dark: 'rgb(var(--color-border-dark) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
