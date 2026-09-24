// Tailwind 4 compatibility config. Values transcribed from the supplied handoff
// README; the referenced tokens/tailwind.preset.js is absent from this checkout.
import plugin from 'tailwindcss/plugin';
const config = {
  theme: {
    extend: {
      colors: {
        void: '#04000B', night: '#090714', surface: '#0F0C1D', veil: '#1D1844',
        'veil-strong': '#3A3280', ink: '#F1EEFF', 'ink-2': '#A8A3C7', 'ink-3': '#8580AB',
        'accent-gold': '#E8C26A', 'accent-neon': '#A77BFF', 'accent-cyan': '#3FE0D0',
        karas: '#F6DC8E', success: '#5BE3A5', danger: '#FF5A6E', 'danger-ink': '#FF8A98',
        'rarity-c': '#9097AB', 'rarity-r': '#D08A55', 'rarity-sr': '#E8EDF5', 'rarity-ssr': '#FF5FA8', 'rarity-lr': '#E8C26A',
      },
      borderRadius: { badge: '4px', input: '10px', card: '12px', panel: '16px', modal: '20px' },
      boxShadow: { card: '0 8px 24px rgba(4,0,11,.7)', modal: '0 30px 80px rgba(4,0,11,.9)', gold: '0 0 30px rgba(232,194,106,.35)' },
      backgroundImage: { karas: 'linear-gradient(135deg,#FFF3C4,#E8C26A 55%,#9A7420)' },
      transitionTimingFunction: { yokkai: 'cubic-bezier(.2,.8,.2,1)' },
    },
  },
  plugins: [plugin(({ addBase }) => {
    // Compatibility configs generate literal utilities. Export the same values
    // for component CSS instead of maintaining a second palette by hand.
    addBase({ ':root': Object.fromEntries([
      ...Object.entries(config.theme.extend.colors).map(([name, value]) => [`--color-${name}`, value]),
      ...Object.entries(config.theme.extend.boxShadow).map(([name, value]) => [`--shadow-${name}`, value]),
    ]) });
  })],
};
export default config;
