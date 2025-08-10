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
          primary: '#6366f1',
          success: '#82ca9d',
          warning: '#ffc658',
          danger: '#ff8042',
        },
        surface: {
          light: '#f3f4f6',
          dark: '#111827',
        },
        text: {
          DEFAULT: '#1f2937',
          light: '#f3f4f6',
          muted: '#6b7280',
          'muted-dark': '#9ca3af',
        },
        border: {
          light: '#e5e7eb',
          dark: '#4b5563',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
