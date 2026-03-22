/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bill: {
          primary: '#0059b3',
          blue: '#1a75ff',
          blueDark: '#0047b3',
          pale: '#e6f2ff',
          gold: '#fbc02d',
          border: '#dbe7f0',
          surface: '#ffffff',
          danger: '#d32f2f',
        },
        /** ชื่อเดิมจากธีมชมพู — ชี้ไปโทนน้ำเงินเพื่อไม่ต้องแก้ class ทุกไฟล์ */
        disney: {
          magenta: '#0059b3',
          'magenta-light': '#c9dcf0',
          'magenta-soft': '#e6f2ff',
          pink: '#1a75ff',
          'pink-pale': '#e6f2ff',
          rose: '#0047b3',
        },
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0, 89, 179, 0.08)',
      },
    },
  },
  plugins: [],
}
