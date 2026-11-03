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
    .masthead, .journal, .routes, .footer, .view-caption, .view-controls, .crosshair, .flight-indicator, .scale-note { display: none !important; }
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
  const stars = Array.from({ length: 60 }, (_, index) => {
    const x = 25 + index * 67.31 % 650;
    const y = 18 + index * 83.19 % 610;
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${index % 9 === 0 ? 1 : 0.6}" fill="#dedede" opacity="${index % 9 === 0 ? 0.5 : 0.22}"/>`;
  }).join('\n');

  function document(width, height, content) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
<title id="title">DISTANCE - Antonio Chapinal</title>
<desc id="description">A real render from Antonio's original Three.js expedition: volcanic Vesper, orbiting hardware and a vast starfield. Open the linked 3D experience to travel between six geological worlds and discover the projects behind them.</desc>
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
<text x="54" y="58" fill="#dedede" font-size="12" letter-spacing="3.2" class="mono">ANTONIO CHAPINAL</text>
<text x="1226" y="58" text-anchor="end" fill="#919191" font-size="10" letter-spacing="1.5" class="mono">FIELD JOURNAL / VOL. 001</text>
<path d="M54 110H98" stroke="#fd8ea1" stroke-width="2"/>
<text x="49" y="292" fill="#dedede" font-size="124" letter-spacing="-8" font-weight="300">DISTANCE</text>
<text x="56" y="346" fill="#dedede" font-size="27" letter-spacing="-.5">Take the longer way home.</text>
<text x="56" y="388" fill="#919191" font-size="15">Six invented worlds. Real engineering behind each one.</text>
<rect x="54" y="446" width="270" height="55" rx="8" fill="#fd8ea1"/>
<text x="77" y="479" fill="#1a1a1a" font-size="12" letter-spacing="1" class="mono">LAUNCH 3D EXPEDITION</text>
<path d="M290 469H302V481M302 469L290 481" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
<path d="M54 566H1226" stroke="#474747"/>
<text x="54" y="602" fill="#919191" font-size="10" letter-spacing="1.7" class="mono">CLOUD / AI / QUANTUM / CREATIVE ENGINEERING</text>
<circle cx="1044" cy="598" r="3" fill="#fd8ea1"/>
<text x="1058" y="602" fill="#dedede" font-size="10" letter-spacing="1.2" class="mono">VESPER / 001</text>`);
  const mobile = document(700, 920, `
<image x="-380" y="0" width="1440" height="720" href="${frame.png}"/>
<text x="40" y="55" fill="#dedede" font-size="15" letter-spacing="3" class="mono">CHAPI / FIELD JOURNAL</text>
<text x="660" y="55" text-anchor="end" fill="#fd8ea1" font-size="15" class="mono">001</text>
<path d="M40 631H84" stroke="#fd8ea1" stroke-width="2"/>
<text x="100" y="636" fill="#919191" font-size="13" letter-spacing="1.5" class="mono">VESPER / VOLCANIC RELAY</text>
<text x="34" y="744" fill="#dedede" font-size="108" letter-spacing="-7" font-weight="300">DISTANCE</text>
<text x="40" y="791" fill="#dedede" font-size="25">Take the longer way home.</text>
<rect x="40" y="826" width="620" height="55" rx="8" fill="#fd8ea1"/>
<text x="62" y="859" fill="#1a1a1a" font-size="14" letter-spacing="1.5" class="mono">LAUNCH 3D EXPEDITION</text>
<path d="M620 845H634V859M634 845L620 859" fill="none" stroke="#1a1a1a" stroke-width="1.8"/>
<text x="40" y="911" fill="#919191" font-size="11" letter-spacing="1.5" class="mono">ANTONIO CHAPINAL / CLOUD &amp; AI ENGINEERING</text>`);
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
