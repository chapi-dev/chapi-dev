import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assets = new URL('../assets/', import.meta.url);
const worlds = [
  { slug: 'qubit-9', name: 'QUBIT-9', kind: 'QUANTUM', repo: 'Introduction-to-Quantum-Computing', color: '#cfb7eb', size: 148, rx: 170, ry: 96, phase: 2.9, period: 46, spin: 104, moon: 'cat', moonPeriod: 11 },
  { slug: 'foundria', name: 'FOUNDRIA', kind: 'AI AGENTS', repo: 'agent-hosting-lab', color: '#f0b29b', size: 168, rx: 260, ry: 135, phase: 5.25, period: 72, spin: 137, moon: 'robot', moonPeriod: 14 },
  { slug: 'nimbus-7', name: 'NIMBUS-7', kind: 'PRIVATE CLOUD', repo: 'fabric-private-networking-cookbook', color: '#b5dbc9', size: 170, rx: 335, ry: 173, phase: 0.3, period: 100, spin: 159, moon: 'satellite', moonPeriod: 17 },
  { slug: 'gitopia', name: 'GITOPIA', kind: 'DEVSECOPS', repo: 'telco-devsecops-demo', color: '#eac18b', size: 154, rx: 395, ry: 211, phase: 3.6, period: 130, spin: 123, moon: 'cargo', moonPeriod: 13 },
  { slug: 'pixelune', name: 'PIXELUNE', kind: 'CREATIVE CODE', repo: 'collage-studio', color: '#bdd2ef', size: 164, rx: 450, ry: 248, phase: 1.15, period: 160, spin: 181, moon: 'camera', moonPeriod: 19 },
  { slug: 'copilotia', name: 'COPILOTIA', kind: 'SIDE QUESTS', repo: 'ghcopilot-optimization-workshop', color: '#c4d5a5', size: 164, rx: 500, ry: 285, phase: 4.85, period: 195, spin: 211, moon: 'rocket', moonPeriod: 16 },
];
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const number = value => value.toFixed(3);
const position = (rx, ry, angle) => `translate(${number(rx * Math.cos(angle))}px, ${number(ry * Math.sin(angle))}px)`;

function route(name, rx, ry, phase, plane) {
  const frames = Array.from({ length: 73 }, (_, index) => {
    const angle = phase + (index / 72) * Math.PI * 2;
    const opacity = plane ? `opacity:${(Math.sin(angle) >= 0) === (plane === 'front') ? 1 : 0};` : '';
    return `${number(index / 72 * 100)}%{transform:${position(rx, ry, angle)};${opacity}}`;
  }).join('');
  return `@keyframes ${name}{${frames}}`;
}

function sprite(world) {
  return `<image x="${-world.size / 2}" y="${-world.size / 2}" width="${world.size}" height="${world.size}" href="data:image/png;base64,${world.image}"/>`;
}

function satellite(kind, color) {
  const outline = 'stroke="#695b63" stroke-width="1.6" stroke-linejoin="round"';
  switch (kind) {
    case 'cat':
      return `<path d="M-10 5V-10L-3 -5H3L10 -10V5Q0 15 -10 5Z" fill="#efe1c9" ${outline}/><circle cx="-4" cy="2" r="1.2" fill="#695b63"/><circle cx="4" cy="2" r="1.2" fill="#695b63"/><path d="M-2 6Q0 8 2 6" ${outline}/>`;
    case 'robot':
      return `<path d="M0 -10V-16" ${outline}/><circle cy="-17" r="2.5" fill="#e9b08d"/><rect x="-12" y="-10" width="24" height="21" rx="6" fill="#eee0c7" ${outline}/><rect x="-8" y="-5" width="16" height="10" rx="3" fill="#334d61"/><path d="M-5 0H-2 M2 0H5" stroke="${color}" stroke-width="2"/><path d="M-15 -1H-12 M12 -1H15" ${outline}/>`;
    case 'satellite':
      return `<rect x="-8" y="-9" width="16" height="18" rx="3" fill="#eee0c7" ${outline}/><path d="M-8 0H-13 M8 0H13" ${outline}/><rect x="-25" y="-8" width="12" height="16" rx="1" fill="#7eacc8" ${outline}/><rect x="13" y="-8" width="12" height="16" rx="1" fill="#7eacc8" ${outline}/><path d="M-19 -8V8 M19 -8V8 M-25 0H-13 M13 0H25" stroke="#e9dfc9" stroke-width=".7"/><path d="M0 -9L3 -15" ${outline}/>`;
    case 'cargo':
      return `<path d="M0 -13L13 -6V8L0 15L-13 8V-6Z" fill="#e9bd7a" ${outline}/><path d="M-13 -6L0 1L13 -6 M0 1V15 M-6 -10L7 -3" ${outline}/><path d="M3 5L6 8L10 3" stroke="#586b58" stroke-width="2" fill="none"/>`;
    case 'camera':
      return `<rect x="-15" y="-9" width="30" height="20" rx="4" fill="#d2c8bc" ${outline}/><path d="M-10 -9V-13H-2V-9" ${outline}/><circle cx="3" cy="1" r="7" fill="#334d61" ${outline}/><circle cx="3" cy="1" r="3" fill="${color}"/><rect x="-11" y="-5" width="5" height="3" rx="1" fill="#eee0c7"/>`;
    default:
      return `<path d="M0 -18Q13 -6 9 10L0 15L-9 10Q-13 -6 0 -18Z" fill="#eee0c7" ${outline}/><path d="M-8 3L-15 13L-8 11 M8 3L15 13L8 11" fill="${color}" ${outline}/><circle cy="-2" r="5" fill="#7daec6" ${outline}/><path d="M-4 15L0 24L4 15" fill="#edb475" stroke="#b5836b" stroke-width="1.4"/>`;
  }
}

function planet(world, movement = true) {
  const orbitX = world.size * 0.62;
  const orbitY = world.size * 0.29;
  const satelliteMarkup = satellite(world.moon, world.color);
  return `<g class="${movement ? `travel-${world.slug} moving` : ''}">
    <ellipse rx="${orbitX}" ry="${orbitY}" stroke="${world.color}" stroke-opacity=".3" stroke-width="1" stroke-dasharray="2 6"/>
    <g class="moon-back-${world.slug} moving">${satelliteMarkup}</g>
    <g class="spin-${world.slug} moving">${sprite(world)}</g>
    <g class="moon-front-${world.slug} moving">${satelliteMarkup}</g>
  </g>`;
}

function worldStyles(world) {
  const moonX = world.size * 0.62;
  const moonY = world.size * 0.29;
  const phase = world.phase / 2;
  const front = Math.sin(phase) >= 0;
  return `${route(`travel-${world.slug}`, world.rx, world.ry, world.phase)}
    ${route(`moon-front-${world.slug}`, moonX, moonY, phase, 'front')}
    ${route(`moon-back-${world.slug}`, moonX, moonY, phase, 'back')}
    .travel-${world.slug}{transform:${position(world.rx, world.ry, world.phase)};animation:travel-${world.slug} ${world.period}s linear infinite}
    .spin-${world.slug}{animation:spin ${world.spin}s linear infinite}
    .moon-front-${world.slug}{transform:${position(moonX, moonY, phase)};opacity:${front ? 1 : 0};animation:moon-front-${world.slug} ${world.moonPeriod}s linear infinite}
    .moon-back-${world.slug}{transform:${position(moonX, moonY, phase)};opacity:${front ? 0 : 1};animation:moon-back-${world.slug} ${world.moonPeriod}s linear infinite}`;
}

function document(width, height, title, description, body, styles = '', defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description" fill="none">
<title id="title">${escape(title)}</title>
<desc id="description">${escape(description)}</desc>
<defs>${defs}</defs>
<style>
  text{font-family:"Segoe UI",Aptos,Arial,sans-serif}
  .mono{font-family:Consolas,"Courier New",monospace}
  .moving{transform-origin:0 0}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes glow{0%,100%{opacity:.45}50%{opacity:1}}
  .twinkle{animation:glow 5s ease-in-out infinite}
${styles}
  @media(prefers-reduced-motion:reduce){.moving,.twinkle{animation:none!important}}
</style>
${body}
</svg>
`;
}

function starfield() {
  return Array.from({ length: 175 }, (_, i) => {
    const x = 35 + (i * 193.73 + 19) % 1210;
    const y = 90 + (i * 71.19 + 31) % 775;
    if (i % 13 === 0) {
      return `<path d="M${number(x - 3)} ${number(y)}H${number(x + 3)} M${number(x)} ${number(y - 3)}V${number(y + 3)}" stroke="#e5d5b9" stroke-opacity=".6" stroke-linecap="round"/>`;
    }
    return `<circle cx="${number(x)}" cy="${number(y)}" r="${i % 5 === 0 ? 1.8 : 0.9}" fill="${i % 3 === 0 ? '#d6c6e7' : '#e5d5b9'}" opacity="${i % 5 === 0 ? '.6' : '.25'}" ${i % 7 === 0 ? 'class="twinkle"' : ''}/>`;
  }).join('');
}

function sun() {
  const points = Array.from({ length: 40 }, (_, i) => {
    const angle = i / 40 * Math.PI * 2;
    const radius = i % 2 ? 61 : 69;
    return `${number(Math.cos(angle) * radius)},${number(Math.sin(angle) * radius)}`;
  }).join(' ');
  return `<g transform="translate(640 490)">
    <circle r="110" fill="url(#sun-halo)"/>
    <g class="moving" style="animation:spin 160s linear infinite"><polygon points="${points}" fill="#bd8f68" fill-opacity=".4" stroke="#ecc78e" stroke-opacity=".6" stroke-width="1.5"/></g>
    <circle r="52" fill="#f3d695" stroke="#78634f" stroke-width="2"/>
    <circle cx="-17" cy="-2" r="3.5" fill="#65554a"/><circle cx="17" cy="-2" r="3.5" fill="#65554a"/>
    <ellipse cx="-28" cy="9" rx="7" ry="3" fill="#e3a18a" opacity=".65"/><ellipse cx="28" cy="9" rx="7" ry="3" fill="#e3a18a" opacity=".65"/>
    <path d="M-8 9Q0 18 8 9" stroke="#78634f" stroke-width="2" stroke-linecap="round"/>
    <text y="91" fill="#ddc8a9" text-anchor="middle" font-size="13" letter-spacing="2" class="mono">SOL-0</text>
  </g>`;
}

function universe() {
  const orbitalStyles = worlds.map(worldStyles).join('\n');
  const orbitLines = worlds.map(world =>
    `<ellipse cx="640" cy="490" rx="${world.rx}" ry="${world.ry}" stroke="${world.color}" stroke-opacity=".21" stroke-width="1.3" stroke-dasharray="3 8"/>`).join('');
  const rivets = Array.from({ length: 19 }, (_, i) =>
    `<circle cx="${40 + i * 66.667}" cy="14" r="2.4" fill="#a39785"/><circle cx="${40 + i * 66.667}" cy="946" r="2.4" fill="#a39785"/>`).join('');
  return document(1280, 960, "Antonio's pocket universe",
    'Six original storybook planets travel on elliptical orbits around the smiling star Sol-0. Qubit-9 carries a cat moon, Foundria a robot, Nimbus-7 a satellite, Gitopia a cargo cube, Pixelune a camera, and Copilotia a rocket. Each planet also spins on its own axis. Motion pauses when reduced motion is requested. The landing pads below the illustration open the projects.',
    `<rect x="2" y="2" width="1276" height="956" rx="42" fill="#e6d9c2" stroke="#a99b89" stroke-width="2"/>
    <rect x="15" y="25" width="1250" height="910" rx="31" fill="url(#space)" stroke="#afaa9b" stroke-width="2"/>
    <g clip-path="url(#window)">
      <ellipse cx="1000" cy="290" rx="480" ry="310" fill="url(#nebula)"/>
      <ellipse cx="180" cy="680" rx="430" ry="280" fill="url(#nebula)"/>
      ${starfield()}
      <path d="M66 158L123 120L158 153L206 100 M1033 798L1090 830L1130 790L1199 826" stroke="#d4c7df" stroke-opacity=".22" stroke-width="1"/>
      <g fill="#e5d5b9" opacity=".7"><circle cx="66" cy="158" r="2"/><circle cx="123" cy="120" r="2"/><circle cx="158" cy="153" r="2"/><circle cx="206" cy="100" r="2"/></g>
      <text x="54" y="65" fill="#eadac2" font-size="21" letter-spacing="1.7" class="mono">CHAPI'S POCKET UNIVERSE</text>
      <text x="1223" y="64" text-anchor="end" fill="#a99fb9" font-size="12" class="mono">not to scale. obviously.</text>
      ${orbitLines}
      ${sun()}
      <g transform="translate(640 490)">${worlds.map(world => planet(world)).join('')}</g>
      <text x="640" y="904" fill="#b5acbc" font-size="13" text-anchor="middle" letter-spacing="1.3" class="mono">PLEASE KEEP YOUR WAVEFUNCTION INSIDE THE UNIVERSE.</text>
    </g>
    ${rivets}
    <path d="M7 170H22 M7 790H22 M1258 170H1273 M1258 790H1273" stroke="#a99b89" stroke-width="3" stroke-linecap="round"/>`,
    orbitalStyles,
    `<linearGradient id="space" x2="1" y2="1"><stop stop-color="#122038"/><stop offset=".55" stop-color="#18243d"/><stop offset="1" stop-color="#26243b"/></linearGradient>
    <radialGradient id="nebula"><stop stop-color="#b39bb5" stop-opacity=".14"/><stop offset="1" stop-color="#b39bb5" stop-opacity="0"/></radialGradient>
    <radialGradient id="sun-halo"><stop stop-color="#f2cb8e" stop-opacity=".3"/><stop offset="1" stop-color="#f2cb8e" stop-opacity="0"/></radialGradient>
    <clipPath id="window"><rect x="16" y="26" width="1248" height="908" rx="30"/></clipPath>`);
}

function landing(world) {
  const small = { ...world, size: 142 };
  return document(240, 230, `${world.name} / ${world.kind}`,
    `${world.name} is a landing pad for ${world.repo}. Its miniature satellite follows an elliptical orbit.`,
    `<g transform="translate(120 91)">${planet(small, false)}</g>
    <rect x="34" y="181" width="172" height="30" rx="15" fill="#eadfc9" stroke="#a99b89"/>
    <text x="120" y="201" fill="#65574f" text-anchor="middle" font-size="18" font-weight="650" letter-spacing="1" class="mono">${world.name}</text>
    <text x="120" y="225" fill="#a4917d" text-anchor="middle" font-size="9" letter-spacing="1" class="mono">${world.kind}</text>`,
    worldStyles(small));
}

function wormhole() {
  return document(200, 150, 'An entirely suspicious wormhole',
    'A tiny purple wormhole with a travelling golden star. Enter it to explore adiabatic quantum computing.',
    `<g transform="translate(100 76)">
      <ellipse rx="65" ry="38" fill="#29233e" stroke="#9c8bba" stroke-width="2"/>
      <ellipse rx="49" ry="29" fill="#211e34" stroke="#b49dcb" stroke-width="1.5" transform="rotate(-14)"/>
      <ellipse rx="33" ry="20" fill="#181a2b" stroke="#c1abd0" stroke-width="1.5" transform="rotate(-30)"/>
      <ellipse rx="18" ry="12" fill="#101825" stroke="#cdb8d8" stroke-opacity=".7" transform="rotate(-50)"/>
      <g class="moving" style="animation:spin 9s linear infinite"><path d="M0 -54L3 -45L12 -42L3 -39L0 -30L-3 -39L-12 -42L-3 -45Z" fill="#ebcf95" stroke="#8e785f" stroke-width="1"/></g>
      <path d="M-83 -17L-81 -11L-75 -9L-81 -7L-83 -1L-85 -7L-91 -9L-85 -11Z" fill="#c6afd5"/>
      <text y="66" fill="#a4917d" text-anchor="middle" font-size="10" letter-spacing="2" class="mono">PROBABLY SAFE</text>
    </g>`);
}

for (const world of worlds) {
  world.image = (await readFile(new URL(`planets/${world.slug}.png`, assets))).toString('base64');
}
await mkdir(assets, { recursive: true });
await Promise.all([
  writeFile(new URL('universe.svg', assets), universe()),
  ...worlds.map(world => writeFile(new URL(`land-${world.slug}.svg`, assets), landing(world))),
  writeFile(new URL('wormhole.svg', assets), wormhole()),
]);
console.log(`Generated the pocket universe, six landing pads and a wormhole in ${fileURLToPath(assets)}`);
