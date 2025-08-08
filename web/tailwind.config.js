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
    extend: {},
  },
  plugins: [],
}
