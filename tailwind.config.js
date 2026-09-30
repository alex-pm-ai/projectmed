import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cinzas neutros (sem o tom azulado do gray padrão), combinando com a paleta
        gray: colors.neutral,
        background: '#0f0f0f',
        foreground: '#f8f8f8',
        // Verde escuro: botões e áreas maiores
        primary: '#337418',
        'primary-foreground': '#f8f8f8',
        // Verde vivo: só pequenos destaques e gradientes
        accent: '#5dd62c',
        'accent-foreground': '#0f0f0f',
        card: '#202020',
        'card-border': 'rgba(255,255,255,0.08)',
        muted: '#2a2a2a',
        'muted-foreground': '#a3a3a3',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #337418 0%, #5dd62c 100%)',
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
