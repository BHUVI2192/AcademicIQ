import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'academic-navy': 'hsl(var(--academic-navy))',
        'academic-blue': 'hsl(var(--academic-blue))',
        'academic-cyan': 'hsl(var(--academic-cyan))',
        'academic-yellow': 'hsl(var(--academic-yellow))',
        'academic-purple': 'hsl(var(--academic-purple))',
      },
      fontFamily: {
        sans: ['Montserrat', 'Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

