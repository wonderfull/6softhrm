module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f2f8ff',
          100: '#dceeff',
          200: '#b9e0ff',
          300: '#7fc6ff',
          400: '#47aaff',
          500: '#2b8cff',
          600: '#206fd6',
          700: '#1a57a6',
          800: '#173f7a',
          900: '#112b53',
        },
        accent: {
          50: '#fff6f2',
          100: '#ffefe6',
          200: '#ffd7bf',
          300: '#ffb98a',
          400: '#ff974d',
          500: '#ff7d1a',
          600: '#ff6311',
          700: '#cc4b0e',
          800: '#9a370b',
          900: '#6a2408',
        }
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui'],
        body: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        'card': '0 10px 30px -12px rgba(20,20,30,0.25), 0 2px 6px rgba(22,22,30,0.04)'
      }
    },
  },
  plugins: [],
}
