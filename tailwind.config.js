/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        disney: {
          magenta: '#E91E8C',
          'magenta-light': '#F8B4D9',
          'magenta-soft': '#FCE4EC',
          pink: '#FF69B4',
          'pink-pale': '#FFE4F0',
          rose: '#FF85A2',
        },
      },
    },
  },
  plugins: [],
}
