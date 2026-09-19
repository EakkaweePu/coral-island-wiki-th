// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // ยืนยัน URL จริงอีกครั้งตอน deploy (0.6) แล้วแก้ให้ตรง
  site: 'https://coral-island-wiki-th.pages.dev',

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
  }
});
