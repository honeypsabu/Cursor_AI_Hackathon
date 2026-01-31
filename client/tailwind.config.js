/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8B5CF6',
          hover: '#7C3AED',
          light: '#A78BFA',
        },
        secondary: {
          DEFAULT: '#A78BFA',
          hover: '#8B5CF6',
          light: '#C4B5FD',
        },
        background: '#FFFFFF',
        text: {
          DEFAULT: '#1E293B',
          muted: '#64748B',
          light: '#94A3B8',
        },
      },
    },
  },
  plugins: [],
}
