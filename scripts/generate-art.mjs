import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { missions } from '../web/missions.js';

const root = new URL('../', import.meta.url);
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

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

  const heroFrame = await page.locator('canvas').evaluate(canvas => new Promise(resolve => {
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

  const worldSprites = [];
  for (const mission of missions) {
    await page.goto(`http://127.0.0.1:4174/?scoutTheme=dark&destination=${mission.id}`);
    await page.waitForFunction(() => document.body.dataset.renderer === 'webgl');
    await page.addStyleTag({ content: `
      .masthead, .journal, .routes, .footer, .view-caption, .view-controls, .sector-radar, .crosshair, .flight-indicator, .scale-note { display: none !important; }
      .expedition { display: block; min-height: 0; }
      .viewport { height: 720px; min-height: 0; }
    ` });
    await page.waitForFunction(() => document.querySelector('canvas').width === 1440);
    const sprite = await page.locator('canvas').evaluate(canvas => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const size = 240;
        const crop = 560;
        const out = document.createElement('canvas');
        out.width = out.height = size;
        const ctx = out.getContext('2d');
        ctx.drawImage(canvas, (canvas.width - crop) / 2, (canvas.height - crop) / 2, crop, crop, 0, 0, size, size);
        ctx.globalCompositeOperation = 'destination-in';
        const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.49);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.78, 'rgba(255,255,255,0.96)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        resolve(out.toDataURL('image/png'));
      }));
    }));
    worldSprites.push(sprite);
  }

  const holoCoords = [
    { x: 165, y: 235, planeY: 365, size: 138, accent: '#fd8ea1', tag: 'AZURE AI FOUNDRY' },
    { x: 355, y: 165, planeY: 315, size: 146, accent: '#4da6ff', tag: 'MICROSOFT FABRIC' },
    { x: 545, y: 255, planeY: 390, size: 132, accent: '#dedede', tag: 'Q# & QUANTUM' },
    { x: 485, y: 420, planeY: 515, size: 138, accent: '#fbbf24', tag: 'AKS & DEVSECOPS' },
    { x: 725, y: 185, planeY: 330, size: 140, accent: '#4ade80', tag: 'AZURE SRE AGENT' },
    { x: 895, y: 285, planeY: 415, size: 144, accent: '#fbbf24', tag: 'AZURE ARC & vWAN' },
    { x: 790, y: 435, planeY: 525, size: 140, accent: '#fd8ea1', tag: 'SQL MI & ACA' },
    { x: 1095, y: 225, planeY: 380, size: 156, accent: '#fd8ea1', tag: 'GITHUB COPILOT' },
  ];

  const stars = Array.from({ length: 90 }, (_, index) => {
    const x = 18 + (index * 97.31) % 1244;
    const y = 58 + (index * 67.19) % 540;
    const twinkle = index % 6 === 0 ? ' class="twinkle"' : '';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${index % 8 === 0 ? 1.3 : 0.7}" fill="#dedede" opacity="${index % 8 === 0 ? 0.55 : 0.22}"${twinkle}/>`;
  }).join('\n');

  const lanePath = `M${holoCoords.map(c => `${c.x} ${c.y}`).join('L')}`;
  const crossPath = `M${holoCoords[0].x} ${holoCoords[0].y}L${holoCoords[3].x} ${holoCoords[3].y} M${holoCoords[1].x} ${holoCoords[1].y}L${holoCoords[4].x} ${holoCoords[4].y} M${holoCoords[2].x} ${holoCoords[2].y}L${holoCoords[6].x} ${holoCoords[6].y} M${holoCoords[4].x} ${holoCoords[4].y}L${holoCoords[7].x} ${holoCoords[7].y}`;

  const holoNodesDesktop = missions.map((mission, idx) => {
    const c = holoCoords[idx];
    const half = c.size / 2;
    const orbitRx = (c.size * 0.44).toFixed(1);
    const orbitRy = (c.size * 0.17).toFixed(1);
    const repoCount = 1 + (mission.moons?.length || 0);
    return `<g>
  <line x1="${c.x}" y1="${c.y}" x2="${c.x}" y2="${c.planeY}" stroke="${c.accent}" stroke-opacity=".55" stroke-dasharray="3 3"/>
  <ellipse cx="${c.x}" cy="${c.planeY}" rx="22" ry="8" fill="none" stroke="${c.accent}" stroke-opacity=".65"/>
  <circle cx="${c.x}" cy="${c.planeY}" r="2.5" fill="${c.accent}"/>
  <image x="${(c.x - half).toFixed(1)}" y="${(c.y - half).toFixed(1)}" width="${c.size}" height="${c.size}" href="${worldSprites[idx]}"/>
  <ellipse cx="${c.x}" cy="${c.y}" rx="${orbitRx}" ry="${orbitRy}" fill="none" stroke="${c.accent}" stroke-opacity=".42" stroke-dasharray="4 4"/>
  <circle cx="${c.x}" cy="${c.y}" r="${(c.size * 0.36).toFixed(1)}" fill="none" stroke="${c.accent}" stroke-opacity=".35" stroke-dasharray="10 8" class="spin-slow" style="transform-origin:${c.x}px ${c.y}px"/>
  <g transform="translate(${c.x} ${c.y})"><g class="orbit-${(idx % 3) + 1}"><circle cx="${orbitRx}" cy="0" r="3.2" fill="${c.accent}"/></g></g>
  <rect x="${c.x - 68}" y="${c.y + half - 14}" width="136" height="34" rx="6" fill="#141414" fill-opacity=".88" stroke="#474747"/>
  <text x="${c.x}" y="${c.y + half}" text-anchor="middle" fill="#dedede" font-size="10" font-weight="600" letter-spacing="1" class="mono">0${idx + 1} / ${escape(mission.name.toUpperCase())}</text>
  <text x="${c.x}" y="${c.y + half + 13}" text-anchor="middle" fill="${c.accent}" font-size="8" letter-spacing=".8" class="mono">${escape(c.tag)} (${repoCount})</text>
</g>`;
  }).join('\n');

  const desktopSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="680" viewBox="0 0 1280 680" role="img" aria-labelledby="title description">
<title id="title">DISTANCE - Interactive 3D Microsoft Technology Star Map by Antonio Chapinal</title>
<desc id="description">Animated 3D Galactic Holomap featuring eight procedural planetary systems and 23 repositories across Azure AI Foundry, Microsoft Fabric, Q# Quantum, AKS, Azure SRE Agent, Azure Arc, Azure SQL MI and GitHub Copilot Enterprise.</desc>
<style>
  text{font-family:"Segoe UI",Aptos,Calibri,sans-serif}
  .mono{font-family:Consolas,"Courier New",monospace}
  @keyframes dash{to{stroke-dashoffset:-160}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:.25}50%{opacity:.85}}
  @keyframes scan{0%,100%{transform:translateY(-28px);opacity:.15}50%{transform:translateY(28px);opacity:.75}}
  @keyframes orbitA{0%{transform:translate(0,0)}25%{transform:translate(-55px,18px)}50%{transform:translate(-110px,0)}75%{transform:translate(-55px,-18px)}100%{transform:translate(0,0)}}
  .flow{animation:dash 7s linear infinite}
  .spin-slow{animation:spin 28s linear infinite}
  .twinkle{animation:pulse 4.5s ease-in-out infinite}
  .scan-ring{animation:scan 5.5s ease-in-out infinite}
  .orbit-1,.orbit-2,.orbit-3{animation:orbitA 9s linear infinite}
  .orbit-2{animation-duration:12s}
  .orbit-3{animation-duration:15s}
  @media(prefers-reduced-motion:reduce){.flow,.spin-slow,.twinkle,.scan-ring,.orbit-1,.orbit-2,.orbit-3{animation:none!important}}
</style>
<rect width="1280" height="680" fill="${heroFrame.background}"/>
${stars}
<g opacity=".55">
  <ellipse cx="640" cy="410" rx="560" ry="185" fill="none" stroke="#383838" stroke-dasharray="6 6"/>
  <ellipse cx="640" cy="410" rx="410" ry="135" fill="none" stroke="#383838"/>
  <ellipse cx="640" cy="410" rx="260" ry="86" fill="none" stroke="#383838" stroke-dasharray="4 6"/>
  <ellipse cx="640" cy="410" rx="115" ry="38" fill="none" stroke="#474747"/>
  <line x1="80" y1="410" x2="1200" y2="410" stroke="#2e2e2e"/>
  <line x1="640" y1="215" x2="640" y2="595" stroke="#2e2e2e"/>
  <line x1="220" y1="275" x2="1060" y2="545" stroke="#292929"/>
  <line x1="220" y1="545" x2="1060" y2="275" stroke="#292929"/>
</g>
<path d="${crossPath}" fill="none" stroke="#474747" stroke-width="1.2" stroke-dasharray="4 6"/>
<path d="${lanePath}" fill="none" stroke="#fd8ea1" stroke-opacity=".32" stroke-width="2.5"/>
<path d="${lanePath}" fill="none" stroke="#fd8ea1" stroke-width="2" stroke-dasharray="10 14" class="flow"/>
${holoNodesDesktop}
<rect x="24" y="18" width="1232" height="52" rx="10" fill="#161616" fill-opacity=".9" stroke="#3d3d3d"/>
<circle cx="48" cy="44" r="4.5" fill="#fd8ea1" class="twinkle"/>
<text x="64" y="40" fill="#dedede" font-size="12" font-weight="600" letter-spacing="2.4" class="mono">CHAPI // DISTANCE 3D GALACTIC HOLOMAP</text>
<text x="64" y="56" fill="#919191" font-size="9.5" letter-spacing="1.3" class="mono">ANTONIO CHAPINAL · MICROSOFT CLOUD, AI FOUNDRY, FABRIC, AKS, SRE, ARC &amp; QUANTUM</text>
<rect x="954" y="28" width="286" height="32" rx="6" fill="#fd8ea1"/>
<text x="974" y="48" fill="#1a1a1a" font-size="10.5" font-weight="600" letter-spacing="1.1" class="mono">ENTER INTERACTIVE 3D FLIGHT ↗</text>
<rect x="24" y="612" width="1232" height="48" rx="10" fill="#161616" fill-opacity=".9" stroke="#3d3d3d"/>
<text x="46" y="640" fill="#dedede" font-size="10" letter-spacing="1.4" class="mono">STATUS: 08 PLANETARY SYSTEMS ONLINE · 23 PUBLIC MICROSOFT REPOSITORIES MAPPED</text>
<text x="1234" y="640" text-anchor="end" fill="#fd8ea1" font-size="10" letter-spacing="1.2" class="mono">CLICK ANY WORLD BELOW OR LAUNCH 3D COCKPIT ↗</text>
</svg>
`;

  const mobileCoords = [
    { x: 185, y: 175, size: 132, accent: '#fd8ea1', tag: 'AI FOUNDRY' },
    { x: 515, y: 215, size: 136, accent: '#4da6ff', tag: 'FABRIC' },
    { x: 195, y: 345, size: 128, accent: '#dedede', tag: 'Q# QUANTUM' },
    { x: 505, y: 385, size: 132, accent: '#fbbf24', tag: 'AKS & GHAS' },
    { x: 185, y: 515, size: 132, accent: '#4ade80', tag: 'SRE AGENT' },
    { x: 515, y: 555, size: 136, accent: '#fbbf24', tag: 'AZURE ARC' },
    { x: 195, y: 685, size: 132, accent: '#fd8ea1', tag: 'SQL MI & ACA' },
    { x: 505, y: 725, size: 142, accent: '#fd8ea1', tag: 'GH COPILOT' },
  ];
  const mobileLane = `M${mobileCoords.map(c => `${c.x} ${c.y}`).join('L')}`;
  const holoNodesMobile = missions.map((mission, idx) => {
    const c = mobileCoords[idx];
    const half = c.size / 2;
    return `<g>
  <image x="${c.x - half}" y="${c.y - half}" width="${c.size}" height="${c.size}" href="${worldSprites[idx]}"/>
  <circle cx="${c.x}" cy="${c.y}" r="${(c.size * 0.37).toFixed(1)}" fill="none" stroke="${c.accent}" stroke-opacity=".4" stroke-dasharray="8 6"/>
  <rect x="${c.x - 74}" y="${c.y + half - 14}" width="148" height="32" rx="6" fill="#141414" fill-opacity=".9" stroke="#474747"/>
  <text x="${c.x}" y="${c.y + half}" text-anchor="middle" fill="#dedede" font-size="10.5" font-weight="600" letter-spacing="1" class="mono">0${idx + 1} / ${escape(mission.name.toUpperCase())}</text>
  <text x="${c.x}" y="${c.y + half + 12}" text-anchor="middle" fill="${c.accent}" font-size="8.5" letter-spacing=".8" class="mono">${escape(c.tag)}</text>
</g>`;
  }).join('\n');

  const mobileSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="920" viewBox="0 0 700 920" role="img" aria-labelledby="title description">
<title id="title">DISTANCE - 3D Microsoft Star Map (Mobile)</title>
<desc id="description">Vertical 3D Galactic Holomap with eight procedural planets representing Antonio Chapinal's Microsoft technology repositories.</desc>
<style>
  text{font-family:"Segoe UI",Aptos,Calibri,sans-serif}
  .mono{font-family:Consolas,"Courier New",monospace}
  @keyframes dash{to{stroke-dashoffset:-140}}
  .flow{animation:dash 7s linear infinite}
  @media(prefers-reduced-motion:reduce){.flow{animation:none!important}}
</style>
<rect width="700" height="920" fill="${heroFrame.background}"/>
<ellipse cx="350" cy="460" rx="280" ry="340" fill="none" stroke="#333333" stroke-dasharray="6 6"/>
<ellipse cx="350" cy="460" rx="170" ry="210" fill="none" stroke="#2d2d2d"/>
<path d="${mobileLane}" fill="none" stroke="#fd8ea1" stroke-opacity=".35" stroke-width="2.5"/>
<path d="${mobileLane}" fill="none" stroke="#fd8ea1" stroke-width="2" stroke-dasharray="9 12" class="flow"/>
${holoNodesMobile}
<rect x="24" y="20" width="652" height="58" rx="10" fill="#161616" fill-opacity=".92" stroke="#3d3d3d"/>
<text x="44" y="45" fill="#dedede" font-size="13" font-weight="600" letter-spacing="2" class="mono">CHAPI // DISTANCE 3D HOLOMAP</text>
<text x="44" y="64" fill="#919191" font-size="10" letter-spacing="1.2" class="mono">08 MICROSOFT TECH SYSTEMS · 23 REPOSITORIES</text>
<rect x="24" y="838" width="652" height="58" rx="10" fill="#fd8ea1"/>
<text x="350" y="872" text-anchor="middle" fill="#1a1a1a" font-size="14" font-weight="600" letter-spacing="1.6" class="mono">LAUNCH INTERACTIVE 3D EXPEDITION ↗</text>
</svg>
`;

  const cardOutputs = missions.map((mission, idx) => {
    const c = holoCoords[idx];
    const moons = mission.moons || [];
    const moonDots = moons.map((m, mIdx) => {
      const rx = 74 + mIdx * 16;
      const ry = 24 + mIdx * 6;
      const dur = 8 + mIdx * 3;
      return `<ellipse cx="155" cy="142" rx="${rx}" ry="${ry}" fill="none" stroke="${c.accent}" stroke-opacity=".32" stroke-dasharray="3 4"/>
  <g transform="translate(155 142)"><g class="orbit-${mIdx + 1}" style="animation-duration:${dur}s"><circle cx="${rx}" cy="0" r="3.6" fill="${c.accent}"/></g></g>`;
    }).join('\n  ');
    const stackLine = (mission.stack || []).slice(0, 2).join(' · ').toUpperCase().slice(0, 32);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="310" height="360" viewBox="0 0 310 360" role="img" aria-labelledby="title description">
<title id="title">${escape(mission.code)} ${escape(mission.name)} - ${escape(mission.field)}</title>
<desc id="description">Interactive 3D planetary card for ${escape(mission.name)} (${escape(mission.field)}). Flagship repo: ${escape(mission.repo)} plus ${moons.length} satellite moon repositories.</desc>
<style>
  text{font-family:"Segoe UI",Aptos,Calibri,sans-serif}
  .mono{font-family:Consolas,"Courier New",monospace}
  @keyframes scan{0%,100%{transform:translateY(-48px);opacity:.15}50%{transform:translateY(48px);opacity:.78}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes orbitCard{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
  .scan{animation:scan 4.8s ease-in-out infinite}
  .reticle{animation:spin 24s linear infinite;transform-origin:155px 142px}
  .orbit-1,.orbit-2,.orbit-3{animation:orbitCard 9s linear infinite}
  @media(prefers-reduced-motion:reduce){.scan,.reticle,.orbit-1,.orbit-2,.orbit-3{animation:none!important}}
</style>
<rect width="310" height="360" rx="12" fill="#141414" stroke="#383838" stroke-width="1.5"/>
<rect x="12" y="12" width="286" height="28" rx="6" fill="#1f1f1f" stroke="#333333"/>
<circle cx="26" cy="26" r="3.5" fill="${c.accent}"/>
<text x="38" y="30" fill="#dedede" font-size="10" font-weight="600" letter-spacing="1.4" class="mono">${escape(mission.code)} // ${escape(mission.name.toUpperCase())}</text>
<text x="286" y="30" text-anchor="end" fill="${c.accent}" font-size="9" letter-spacing="1" class="mono">${1 + moons.length} REPOS</text>
<line x1="155" y1="54" x2="155" y2="236" stroke="#292929" stroke-dasharray="3 4"/>
<line x1="34" y1="142" x2="276" y2="142" stroke="#292929" stroke-dasharray="3 4"/>
<image x="45" y="32" width="220" height="220" href="${worldSprites[idx]}"/>
${moonDots}
<circle cx="155" cy="142" r="76" fill="none" stroke="${c.accent}" stroke-opacity=".38" stroke-dasharray="12 10" class="reticle"/>
<line x1="75" y1="142" x2="235" y2="142" stroke="${c.accent}" stroke-opacity=".65" stroke-width="1.4" class="scan"/>
<rect x="14" y="246" width="282" height="100" rx="8" fill="#1b1b1b" stroke="#333333"/>
<text x="26" y="268" fill="${c.accent}" font-size="9" font-weight="600" letter-spacing="1.1" class="mono">${escape(c.tag)}</text>
<text x="26" y="289" fill="#dedede" font-size="15" font-weight="600">${escape(mission.name)} System</text>
<text x="26" y="308" fill="#919191" font-size="10" class="mono">${escape(stackLine)}</text>
<line x1="26" y1="319" x2="284" y2="319" stroke="#2f2f2f"/>
<text x="26" y="335" fill="#dedede" font-size="9.5" class="mono">◐ ${moons.length} MOONS · ${escape(mission.telemetry.gravity)}</text>
<text x="284" y="335" text-anchor="end" fill="${c.accent}" font-size="9.5" font-weight="600" class="mono">FLY 3D ↗</text>
</svg>
`;
    return writeFile(new URL(`assets/sys-0${idx + 1}-${mission.id}.svg`, root), svg);
  });

  await mkdir(new URL('assets/', root), { recursive: true });
  await Promise.all([
    writeFile(new URL('assets/distance-frame.png', root), Buffer.from(heroFrame.png.split(',')[1], 'base64')),
    writeFile(new URL('assets/distance.svg', root), desktopSvg),
    writeFile(new URL('assets/distance-mobile.svg', root), mobileSvg),
    ...cardOutputs,
  ]);
  console.log('Rendered all 8 Three.js worlds into the animated 3D Holomap cover and 8 interactive system HUD cards.');
} finally {
  await browser?.close();
  server.kill();
}
