/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['TechnoType-bold', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'te-bold': ['TechnoType-bold', 'sans-serif'],
        'te-medium': ['TechnoType-medium', 'sans-serif'],
        'te-regular': ['TechnoType-regular', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

