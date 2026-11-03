import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { missions, repositoryUrl } from '../web/missions.js';

const root = new URL('../', import.meta.url);
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('web/main.js', root))],
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  target: 'es2022',
  // Keep vendor GLSL in escaped strings instead of whitespace-sensitive output lines.
  supported: { 'template-literal': false },
  legalComments: 'eof',
});
const [template, styles, license] = await Promise.all([
  readFile(new URL('web/index.html', root), 'utf8'),
  readFile(new URL('web/styles.css', root), 'utf8'),
  readFile(new URL('node_modules/three/LICENSE', root), 'utf8'),
]);
const routes = `<ul>${missions.map(mission => `<li><a href="${repositoryUrl(mission)}">${mission.name}: ${mission.field}</a></li>`).join('')}</ul>`;
const html = template
  .replace('/* APP_STYLES */', () => styles)
  .replace('/* APP_SCRIPT */', () => bundle.outputFiles[0].text.replaceAll('</script', '<\\/script'))
  .replace('<!-- NO_SCRIPT_ROUTES -->', () => routes);
await mkdir(new URL('docs/', root), { recursive: true });
await Promise.all([
  writeFile(new URL('docs/index.html', root), html),
  writeFile(new URL('docs/.nojekyll', root), ''),
  writeFile(new URL('docs/THIRD_PARTY_LICENSES.txt', root), `Three.js (MIT)\n\n${license}`),
]);
console.log(`Built self-contained docs/index.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB). No runtime CDN or external assets.`);
