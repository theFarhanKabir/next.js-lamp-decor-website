import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf-8');
const css = readFileSync('dist/assets/index-B0U9K60D.css', 'utf-8');
const js = readFileSync('dist/assets/index-8VVGtri2.js', 'utf-8')
  .replace(/<\/script>/gi, '<\\/script>')
  .replace(/<\/Script>/gi, '<\\/Script>');

// Inline CSS as <style>
let result = html.replace(
  '<link rel="stylesheet" crossorigin href="./assets/index-B0U9K60D.css">',
  `<style>${css}</style>`
);

// Inline JS as <script>
result = result.replace(
  '<script type="module" crossorigin src="./assets/index-8VVGtri2.js"></script>',
  `<script type="module">${js}<\/script>`
);

writeFileSync('dist/index.html', result);
console.log('Assets inlined into dist/index.html');
