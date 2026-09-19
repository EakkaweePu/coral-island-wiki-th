// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://coral-island-wiki-th.eakkawee-pu.workers.dev',

  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Noto Sans Thai',
      cssVariable: '--font-noto-thai',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['thai', 'latin'],
      display: 'swap',
    },
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [sitemap()]
});