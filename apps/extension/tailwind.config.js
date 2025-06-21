/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/popup/popup.html"
  ],
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      width: {
        'popup': '380px',
      },
      minHeight: {
        'popup': '500px',
      },
    },
  },
  plugins: [],
}