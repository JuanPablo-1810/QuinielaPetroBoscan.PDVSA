/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        petroleo: '#1A0608',      // fondo base (rojo petroleo muy oscuro)
        'petroleo-2': '#23090C',  // superficies / tarjetas
        'petroleo-3': '#2E0D11',  // superficies elevadas / hover
        cancha: '#1FD68A',        // verde (aciertos)
        ambar: '#E8B44E',         // dorado base (acentos, lider)
        oro: '#F6D98A',           // dorado claro (brillos / gradientes)
        crema: '#F6F2E9',         // texto
        linea: '#5A1A20',         // bordes / divisores
        'linea-2': '#3A1014',     // bordes sutiles
      },
      fontFamily: {
        display: ['"Saira Condensed"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(246,217,138,0.04) inset, 0 18px 40px -20px rgba(0,0,0,0.8)',
        'glow-oro': '0 0 0 1px rgba(232,180,78,0.35), 0 12px 30px -10px rgba(232,180,78,0.25)',
        'glow-cancha': '0 0 0 1px rgba(31,214,138,0.45), 0 14px 36px -12px rgba(31,214,138,0.30)',
        oro: '0 10px 30px -8px rgba(232,180,78,0.45)',
      },
      backgroundImage: {
        'oro-grad': 'linear-gradient(135deg, #F6D98A 0%, #E8B44E 45%, #C8902F 100%)',
        'sheen': 'linear-gradient(115deg, transparent 0%, rgba(246,242,233,0.18) 45%, rgba(246,242,233,0.30) 50%, rgba(246,242,233,0.18) 55%, transparent 100%)',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'live-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.82)' },
        },
        'glow-breathe': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.9' },
        },
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.4s ease-in-out infinite',
        'live-pulse': 'live-pulse 1.3s ease-in-out infinite',
        'glow-breathe': 'glow-breathe 4s ease-in-out infinite',
        'rise-in': 'rise-in 0.5s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}