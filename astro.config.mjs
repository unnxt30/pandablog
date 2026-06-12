// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://unnat.xyz',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: 'github-dark-default', wrap: true },
  },
  // /feed/ -> /rss.xml is handled by a Vercel redirect (vercel.json). An Astro
  // `redirects` entry can't be used: `trailingSlash: 'always'` rewrites the
  // target to `/rss.xml/`, which 404s (the build artifact is the file `rss.xml`).
});
