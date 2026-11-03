import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const server = spawn(process.execPath, [fileURLToPath(new URL('scripts/serve.mjs', root))], {
  cwd: fileURLToPath(root),
  env: { ...process.env, PORT: '4174' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Cover preview server did not start.')), 10000);
    server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview server exited: ${code}`)); });
  });
  browser = await chromium.launch({
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 720 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4174/?scoutTheme=dark&destination=vesper');
  await page.waitForFunction(() => document.body.dataset.renderer === 'webgl');
  await page.addStyleTag({ content: `
    .masthead, .journal, .routes, .footer, .view-caption, .view-controls, .sector-radar, .crosshair, .flight-indicator, .scale-note { display: none !important; }
    .expedition { display: block; min-height: 0; }
    .viewport { height: 720px; min-height: 0; }
  ` });
  await page.waitForFunction(() => document.querySelector('canvas').width === 1440);
  const frame = await page.locator('canvas').evaluate(canvas => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const sample = document.createElement('canvas');
      sample.width = sample.height = 1;
      const context = sample.getContext('2d');
      context.drawImage(canvas, 0, 0);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      resolve({
        png: canvas.toDataURL('image/png'),
        background: `#${[...pixel].slice(0, 3).map(value => value.toString(16).padStart(2, '0')).join('')}`,
      });
    }));
  }));
  const stars = Array.from({ length: 65 }, (_, index) => {
    const x = 25 + index * 67.31 % 650;
    const y = 18 + index * 83.19 % 610;
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${index % 9 === 0 ? 1.1 : 0.65}" fill="#dedede" opacity="${index % 9 === 0 ? 0.52 : 0.22}"/>`;
  }).join('\n');

  const holoMiniMap = `
<g transform="translate(54 108)">
  <rect width="380" height="84" rx="8" fill="#1a1a1a" fill-opacity=".68" stroke="#474747"/>
  <text x="16" y="22" fill="#fd8ea1" font-size="9" letter-spacing="1.6" class="mono">3D GALACTIC HOLOMAP // 08 MICROSOFT SYSTEMS</text>
  <path d="M22 60L68 44L114 64L160 40L206 58L252 42L298 62L348 46" fill="none" stroke="#5f5f5f" stroke-dasharray="3 3"/>
  <path d="M22 60V72 M68 44V72 M114 64V72 M160 40V72 M206 58V72 M252 42V72 M298 62V72 M348 46V72" stroke="#fd8ea1" stroke-opacity=".45"/>
  <circle cx="22" cy="60" r="4.5" fill="#fd8ea1"/><circle cx="68" cy="44" r="3.2" fill="#dedede"/><circle cx="114" cy="64" r="3.2" fill="#dedede"/><circle cx="160" cy="40" r="3.2" fill="#dedede"/><circle cx="206" cy="58" r="3.2" fill="#dedede"/><circle cx="252" cy="42" r="3.2" fill="#dedede"/><circle cx="298" cy="62" r="3.2" fill="#dedede"/><circle cx="348" cy="46" r="3.8" fill="#fd8ea1"/>
  <text x="16" y="76" fill="#919191" font-size="8" letter-spacing="1.1" class="mono">FOUNDRY · FABRIC · Q# · AKS · SRE · ARC · SQL MI · COPILOT</text>
</g>`;

  function document(width, height, content) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
<title id="title">DISTANCE - Antonio Chapinal</title>
<desc id="description">An interactive 3D space exploration experience and tactical star map built with Three.js. Fly across eight detailed planetary systems and orbiting moons representing Antonio Chapinal's Microsoft cloud, AI Foundry, Fabric, AKS, SRE, Arc and Quantum repositories.</desc>
<style>text{font-family:"Segoe UI",Aptos,Calibri,sans-serif}.mono{font-family:Consolas,"Courier New",monospace}</style>
<rect width="${width}" height="${height}" fill="${frame.background}"/>
${content}
</svg>
`;
  }
  const desktop = document(1280, 640, `
<defs><linearGradient id="fade" x1="240" x2="760" gradientUnits="userSpaceOnUse"><stop stop-color="#000000"/><stop offset="1" stop-color="#ffffff"/></linearGradient><mask id="scene"><rect x="240" y="-40" width="1440" height="720" fill="url(#fade)"/></mask></defs>
${stars}
<image x="240" y="-40" width="1440" height="720" href="${frame.png}" mask="url(#scene)"/>
<text x="54" y="56" fill="#dedede" font-size="12" letter-spacing="3.2" class="mono">ANTONIO CHAPINAL // MICROSOFT CLOUD &amp; AI</text>
<text x="1226" y="56" text-anchor="end" fill="#919191" font-size="10" letter-spacing="1.5" class="mono">FLIGHT DECK / 08 SYSTEMS · 23 REPOS</text>
${holoMiniMap}
<text x="49" y="316" fill="#dedede" font-size="118" letter-spacing="-7.5" font-weight="300">DISTANCE</text>
<text x="56" y="366" fill="#dedede" font-size="25" letter-spacing="-.4">Fly the 3D star map. Scan the worlds. Open the stack.</text>
<text x="56" y="404" fill="#919191" font-size="14">Eight procedural worlds and orbiting moons across Foundry, Fabric, Q#, AKS, SRE, Arc &amp; Copilot.</text>
<rect x="54" y="446" width="310" height="55" rx="8" fill="#fd8ea1"/>
<text x="77" y="479" fill="#1a1a1a" font-size="12" letter-spacing="1.1" class="mono">LAUNCH 3D STAR MAP &amp; FLIGHT</text>
<path d="M330 469H342V481M342 469L330 481" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
<path d="M54 566H1226" stroke="#474747"/>
<text x="54" y="602" fill="#919191" font-size="10" letter-spacing="1.5" class="mono">WASD FLIGHT · [M] 3D HOLOMAP · [F] SURFACE SCAN · [1-8] HYPERDRIVE</text>
<circle cx="1014" cy="598" r="3" fill="#fd8ea1"/>
<text x="1028" y="602" fill="#dedede" font-size="10" letter-spacing="1.2" class="mono">SYS-01 VESPER / FOUNDRY</text>`);
  const mobile = document(700, 920, `
<image x="-380" y="0" width="1440" height="720" href="${frame.png}"/>
<text x="40" y="55" fill="#dedede" font-size="14" letter-spacing="2.6" class="mono">CHAPI / 3D MICROSOFT ATLAS</text>
<text x="660" y="55" text-anchor="end" fill="#fd8ea1" font-size="14" class="mono">08 SYS</text>
<path d="M40 626H84" stroke="#fd8ea1" stroke-width="2"/>
<text x="100" y="631" fill="#919191" font-size="12" letter-spacing="1.4" class="mono">FOUNDRY · FABRIC · Q# · AKS · SRE · ARC · SQL · COPILOT</text>
<text x="34" y="738" fill="#dedede" font-size="104" letter-spacing="-6.5" font-weight="300">DISTANCE</text>
<text x="40" y="786" fill="#dedede" font-size="23">Fly the 3D star map. Scan every Microsoft stack.</text>
<rect x="40" y="824" width="620" height="55" rx="8" fill="#fd8ea1"/>
<text x="62" y="857" fill="#1a1a1a" font-size="14" letter-spacing="1.4" class="mono">LAUNCH 3D STAR MAP &amp; EXPEDITION</text>
<path d="M620 843H634V857M634 843L620 857" fill="none" stroke="#1a1a1a" stroke-width="1.8"/>
<text x="40" y="910" fill="#919191" font-size="11" letter-spacing="1.4" class="mono">ANTONIO CHAPINAL / 08 WORLDS · 23 REPOSITORIES</text>`);
  await mkdir(new URL('assets/', root), { recursive: true });
  await Promise.all([
    writeFile(new URL('assets/distance-frame.png', root), Buffer.from(frame.png.split(',')[1], 'base64')),
    writeFile(new URL('assets/distance.svg', root), desktop),
    writeFile(new URL('assets/distance-mobile.svg', root), mobile),
  ]);
  console.log('Rendered the actual Three.js scene and generated both original DISTANCE covers.');
} finally {
  await browser?.close();
  server.kill();
}
