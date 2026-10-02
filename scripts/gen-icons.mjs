// Renders the PWA / home-screen PNG icons from the SVG logos in /public.
// Usage: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const render = (svg, size, out) => {
  const png = new Resvg(readFileSync(`public/${svg}`, 'utf8'), { fitTo: { mode: 'width', value: size } })
    .render().asPng();
  writeFileSync(`public/${out}`, png);
  console.log(`public/${out}`);
};

render('app-icon.svg',      192, 'pwa-192x192.png');           // rounded tile ("any" purpose)
render('app-icon.svg',      512, 'pwa-512x512.png');
render('logo-maskable.svg', 512, 'pwa-maskable-512x512.png');  // full-bleed, safe-zone padded
render('logo-maskable.svg', 180, 'apple-touch-icon.png');      // iOS rounds the corners itself
