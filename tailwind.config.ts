// Tailwind 4 compatibility config. Values transcribed from the supplied handoff
// README; the referenced tokens/tailwind.preset.js is absent from this checkout.
import plugin from 'tailwindcss/plugin';
import { animationCssVariables } from './lib/ui/animations';
const config = {
  theme: {
    extend: {
      colors: {
        void: '#04000B', night: '#090714', surface: '#0F0C1D', elevated: '#16122B', veil: '#1D1844',
        'veil-strong': '#2E276D', focus: '#5244B5', ink: '#F2F0FF', 'ink-2': '#A29DBE', 'ink-3': '#625C83', disabled: '#3E385D',
        'accent-gold': '#E8C26A', 'accent-neon': '#A77BFF', 'accent-cyan': '#3FE0D0',
        karas: '#FFCC33', success: '#00E699', warning: '#FF9900', danger: '#FF3355', 'danger-ink': '#FF7188',
        'rarity-c': '#9097AB', 'rarity-r': '#D08A55', 'rarity-sr': '#E8EDF5', 'rarity-ssr': '#FF5FA8', 'rarity-lr': '#E8C26A',
      },
      borderRadius: { badge: '4px', input: '8px', card: '12px', panel: '14px', modal: '14px', pill: '24px' },
      boxShadow: { card: '0 8px 24px -4px rgba(4,0,11,.8),0 0 0 1px #1D1844', hover: '0 12px 32px -4px rgba(4,0,11,.95),0 0 12px rgba(82,68,181,.4)', modal: '0 20px 50px rgba(0,0,0,.9)', gold: '0 0 30px rgba(232,194,106,.35)', inset: 'inset 0 2px 6px rgba(0,0,0,.6)', interactive: '0 0 16px rgba(82,68,181,.5)', focus: '0 0 10px rgba(82,68,181,.3)', tab: '0 2px 8px rgba(0,0,0,.5)', toast: '0 10px 25px rgba(0,0,0,.8)', chip: '0 0 8px rgba(82,68,181,.4)' },
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
      ...Object.entries(config.theme.extend.borderRadius).map(([name, value]) => [`--radius-${name}`, value]),
      ...Object.entries(config.theme.extend.backgroundImage).map(([name, value]) => [`--background-${name}`, value]),
      ...Object.entries(animationCssVariables),
      ['--layout-content-max', '72rem'],
      ['--layout-collection-max', '100rem'],
      ['--layout-gutter', '1.5rem'],
      ['--layout-gutter-compact', '1rem'],
      ['--topbar-height', '4.5rem'],
      ['--topbar-panel-width', '25rem'],
      ['--collection-grid-gap', '1rem'],
      ['--collection-row-gap', '1.5rem'],
      ['--collection-detail-width', '62rem'],
      ['--collection-detail-art-width', '16rem'],
      ['--collection-sidebar-width', '15rem'],
      ['--collection-drawer-width', '21rem'],
      ['--collection-list-card-width', '8rem'],
      ['--collection-list-card-width-mobile', '6.5rem'],
      ['--booster-panel-min', '26rem'],
      ['--booster-art-height', '20rem'],
      ['--booster-orbit-size', '16rem'],
      ['--booster-pack-width', '11.25rem'],
      ['--booster-pack-height', '16.875rem'],
      ['--booster-reveal-max', '52rem'],
      ['--booster-reveal-gap', '1rem'],
      ['--booster-reveal-gap-compact', '0.625rem'],
      ['--booster-progress-dot', '1.5rem'],
      ['--market-card-min', '10.5rem'],
      ['--market-art-width', '22rem'],
      ['--market-art-width-mobile', '13.5rem'],
      ['--market-detail-max', '66rem'],
      ['--market-sell-modal-width', '40rem'],
      ['--market-sell-art-width', '9.5rem'],
    ]) });
  })],
};
export default config;
