/* Cấu hình Tailwind CDN dùng chung cho mọi trang (nạp sau script Tailwind). */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        forest: { 50: '#eef5ea', 100: '#d9ead0', 200: '#b9d6a8', 500: '#3d7d4d', 600: '#2f6a3f', 700: '#26553a', 800: '#1d4030' },
        deep: { 50: '#e8f0f3', 100: '#c8dce3', 600: '#1d4a5e', 700: '#143a4b', 800: '#0f2e3c', 900: '#0a212b' },
        cream: { DEFAULT: '#fbf6ea', 100: '#f6eed9', 200: '#eadfc2' },
        ochre: { 100: '#f6e7c6', 400: '#d8a73e', 500: '#c4902c', 600: '#a8761f' },
        crimson: { 50: '#f9ecec', 500: '#a33a3a', 600: '#8e2b2b', 700: '#722121' },
        ink: '#1f2a24'
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif']
      },
      boxShadow: { card: '0 6px 24px -8px rgba(20,58,75,.25)' }
    }
  }
};
