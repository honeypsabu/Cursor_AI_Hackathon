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
          DEFAULT: '#8B5CF6',    // Electric Violet - Buttons, Level-up icons, Branding
          hover: '#7C3AED',
          light: '#A78BFA',
        },
        secondary: {
          DEFAULT: '#06B6D4',    // Tropical Teal - Online status, Achievement badges
          hover: '#0891B2',
          light: '#22D3EE',
        },
        accent: {
          DEFAULT: '#FACC15',    // Cyber Yellow - Streak counters, Rare alerts
          hover: '#EAB308',
          light: '#FDE047',
        },
        background: '#F8FAFC',   // Soft Pearl - Main app background
        text: {
          DEFAULT: '#1E293B',    // Deep Navy - High readability
          muted: '#64748B',
          light: '#94A3B8',
        },
      },
    },
  },
  plugins: [],
}
