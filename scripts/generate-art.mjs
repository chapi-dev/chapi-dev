import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assets = fileURLToPath(new URL('../assets/', import.meta.url));
const sans = "'Segoe UI', Inter, Arial, sans-serif";
const mono = "'Cascadia Code', 'SFMono-Regular', Consolas, monospace";

const point = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;
const line = (points, close = false) =>
  `M${points.map(([x, y]) => point(x, y)).join(' L')}${close ? ' Z' : ''}`;

function document(width, height, title, description, body, extraDefs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-labelledby="title description">
  <title id="title">${title}</title>
  <desc id="description">${description}</desc>
  <defs>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#6574a1" stop-opacity=".55"/><stop offset=".5" stop-color="#22304c" stop-opacity=".3"/><stop offset="1" stop-color="#5ce4cf" stop-opacity=".35"/>
    </linearGradient>
    <linearGradient id="type" x1="0" y1="0" x2="1" y2=".5">
      <stop stop-color="#fff"/><stop offset=".48" stop-color="#e0dcff"/><stop offset="1" stop-color="#7cf5d2"/>
    </linearGradient>
    <radialGradient id="atmosphere">
      <stop stop-color="#4f46a8" stop-opacity=".34"/><stop offset="1" stop-color="#4f46a8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sphere" cx=".35" cy=".25" r=".8">
      <stop stop-color="#193344"/><stop offset=".55" stop-color="#0b1d2c"/><stop offset="1" stop-color="#070b18"/>
    </radialGradient>
    <linearGradient id="orb" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#b4a1ff"/><stop offset=".5" stop-color="#63cde8"/><stop offset="1" stop-color="#78ffce"/>
    </linearGradient>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" stroke="#647ba6" stroke-opacity=".065"/>
    </pattern>
    <clipPath id="frame"><rect width="${width}" height="${height}" rx="24"/></clipPath>
${extraDefs ? `    ${extraDefs}\n` : ''}  </defs>
  <style>
    text { font-family: ${sans}; }
    .mono { font-family: ${mono}; }
    .orbit { animation: orbit 60s linear infinite; }
    .reverse { animation: orbit 85s linear infinite reverse; }
    .beacon { animation: beacon 4s ease-in-out infinite; }
    @keyframes orbit { to { transform: rotate(360deg); } }
    @keyframes beacon { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .orbit, .reverse, .beacon { animation: none; }
    }
  </style>
  <g clip-path="url(#frame)">
    <rect width="${width}" height="${height}" fill="#080d19"/>
    ${body}
    <rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="23.5" stroke="url(#edge)"/>
  </g>
</svg>
`;
}

function stars(width, height, count = 48) {
  return Array.from({ length: count }, (_, i) => {
    const x = ((i * 193.73 + 19) % width).toFixed(2);
    const y = ((i * 71.19 + 31) % height).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${i % 7 === 0 ? 1.4 : 0.7}" fill="#c6d9fc" opacity="${i % 7 === 0 ? 0.55 : 0.18}"/>`;
  }).join('\n');
}

function project(x, y, z) {
  const a = 0.48;
  const b = -0.32;
  const yy = y * Math.cos(a) - z * Math.sin(a);
  const zz = y * Math.sin(a) + z * Math.cos(a);
  return [x * Math.cos(b) - yy * Math.sin(b), x * Math.sin(b) + yy * Math.cos(b), zz];
}

function orbitalSystem(x, y, scale = 1) {
  const radius = 158;
  const paths = [];
  for (let meridian = 0; meridian < 12; meridian++) {
    const phi = (meridian / 12) * Math.PI * 2;
    const points = Array.from({ length: 81 }, (_, i) => {
      const theta = (i / 80) * Math.PI * 2;
      return project(radius * Math.cos(theta) * Math.cos(phi), radius * Math.sin(theta), radius * Math.cos(theta) * Math.sin(phi));
    });
    paths.push(`<path d="${line(points)}" stroke="url(#orb)" stroke-opacity=".21" stroke-width=".8"/>`);
  }
  for (let latitude = -3; latitude <= 3; latitude++) {
    const theta = (latitude / 4) * Math.PI / 2;
    const ring = radius * Math.cos(theta);
    const points = Array.from({ length: 81 }, (_, i) => {
      const phi = (i / 80) * Math.PI * 2;
      return project(ring * Math.cos(phi), radius * Math.sin(theta), ring * Math.sin(phi));
    });
    paths.push(`<path d="${line(points)}" stroke="url(#orb)" stroke-opacity=".22" stroke-width=".8"/>`);
  }
  const nodes = Array.from({ length: 42 }, (_, i) => {
    const y = 1 - (i / 41) * 2;
    const ring = Math.sqrt(1 - y * y);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    return project(radius * ring * Math.cos(angle), radius * y, radius * ring * Math.sin(angle));
  }).filter(([, , z]) => z > 10);
  const connections = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]) < 88) {
        connections.push(`<path d="${line([nodes[i], nodes[j]])}" stroke="#81ead6" stroke-opacity=".19"/>`);
      }
    }
  }
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const angle = (i / 72) * Math.PI * 2;
    const inner = i % 6 === 0 ? 200 : 205;
    return `<path d="M${point(Math.cos(angle) * inner, Math.sin(angle) * inner)} L${point(Math.cos(angle) * 209, Math.sin(angle) * 209)}" stroke="#8da8cb" stroke-opacity="${i % 6 === 0 ? 0.55 : 0.2}"/>`;
  }).join('');
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <circle r="239" fill="url(#atmosphere)"/>
    <circle r="159" stroke="#76e7d2" stroke-opacity=".32" stroke-width="8" filter="url(#glow)"/>
    <circle r="158" fill="url(#sphere)" stroke="url(#orb)" stroke-opacity=".55"/>
    ${paths.join('\n')}
    ${connections.join('\n')}
    ${nodes.map(([x, y], i) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${i % 4 === 0 ? 2.8 : 1.6}" fill="${i % 4 === 0 ? '#bcfff0' : '#72c9de'}" opacity=".85"/>`).join('\n')}
    <g transform="rotate(-27)">
      <ellipse rx="244" ry="76" stroke="#97ddf1" stroke-opacity=".12" stroke-width="9" filter="url(#glow)"/>
      <ellipse rx="244" ry="76" stroke="url(#orb)" stroke-opacity=".7" stroke-width="1.5"/>
      <ellipse rx="253" ry="84" stroke="#a9a0ff" stroke-opacity=".15" stroke-dasharray="3 9"/>
      <circle cx="244" r="4" fill="#b9fff0"/>
      <circle cx="244" r="9" fill="#96ffdc" opacity=".3" filter="url(#glow)"/>
    </g>
    <g class="orbit">
      <circle r="188" stroke="#7595b8" stroke-opacity=".19" stroke-dasharray="2 12"/>
      <path d="M0 -188 A188 188 0 0 1 133 -133" stroke="#ad9df6" stroke-width="2.5" stroke-linecap="round"/>
      <circle cy="-188" r="4" fill="#c2b3ff"/>
    </g>
    <g class="reverse">
      ${ticks}
      <circle cy="209" r="3" fill="#78f8cd"/>
    </g>
    <path d="M-11 0H11 M0 -11V11" stroke="#c5fff0" stroke-opacity=".65"/>
    <circle r="5" fill="#b2ffe5" class="beacon"/>
  </g>`;
}

function hero(mobile = false) {
  const width = mobile ? 720 : 1280;
  const height = mobile ? 900 : 580;
  const content = mobile
    ? `<ellipse cx="360" cy="548" rx="340" ry="300" fill="url(#atmosphere)"/>
      <text x="38" y="61" fill="#f3f5ff" font-size="27" font-weight="750" letter-spacing="2">CHAPI<tspan fill="#7cf5d2">.</tspan>DEV</text>
      <circle cx="502" cy="52" r="4" fill="#8bf5ca" class="beacon"/>
      <text x="517" y="58" fill="#b9c9cf" font-size="14" class="mono">BUILD MODE: ON</text>
      <text x="40" y="127" fill="#9caac3" font-size="20" letter-spacing="2.2">ANTONIO CHAPINAL REYES</text>
      <text x="34" y="225" fill="#f4f4fd" font-size="85" font-weight="800" letter-spacing="-4">BUILD THE</text>
      <text x="34" y="315" fill="url(#type)" font-size="85" font-weight="800" letter-spacing="-4.8">UNEXPECTED.</text>
      <text x="40" y="364" fill="#b5c1d5" font-size="25">Cloud. AI. Quantum. Zero comfort zones.</text>
      ${orbitalSystem(360, 568, 0.88)}
      <path d="M40 783H680" stroke="#657a9d" stroke-opacity=".3"/>
      <text x="40" y="826" fill="#dbe5f3" font-size="20" class="mono" letter-spacing="1">ENGINEERED TO EXPLORE.</text>
      <text x="40" y="864" fill="#84e3cf" font-size="19" class="mono" letter-spacing="1">AZURE / AGENTS / QUBITS</text>
      <path d="M650 840H677 M666 829L677 840L666 851" stroke="#83efd0" stroke-width="2"/>`
    : `<ellipse cx="1010" cy="250" rx="440" ry="350" fill="url(#atmosphere)"/>
      <text x="52" y="59" fill="#f3f5ff" font-size="23" font-weight="750" letter-spacing="2">CHAPI<tspan fill="#7cf5d2">.</tspan>DEV</text>
      <path d="M236 39V61" stroke="#55617d" stroke-opacity=".6"/>
      <text x="257" y="55" fill="#8c9ab4" font-size="11" class="mono" letter-spacing="1.4">PERSONAL LAB / PUBLIC FIELD NOTES</text>
      <rect x="1059" y="32" width="169" height="34" rx="17" fill="#101f26" stroke="#81efcd" stroke-opacity=".23"/>
      <circle cx="1078" cy="49" r="3.5" fill="#8bf5ca" class="beacon"/>
      <text x="1092" y="53" fill="#baebda" font-size="11" class="mono">BUILD MODE: ON</text>
      <text x="56" y="139" fill="#9caac3" font-size="15" letter-spacing="2.8">ANTONIO CHAPINAL REYES</text>
      <text x="46" y="240" fill="#f4f4fd" font-size="98" font-weight="800" letter-spacing="-4">BUILD THE</text>
      <text x="46" y="343" fill="url(#type)" font-size="98" font-weight="800" letter-spacing="-5.5">UNEXPECTED.</text>
      <text x="55" y="394" fill="#b5c1d5" font-size="22">Cloud. AI. Quantum. Zero comfort zones.</text>
      <path d="M56 433H85" stroke="#85f5d0" stroke-width="2"/>
      <text x="97" y="438" fill="#83d8c6" font-size="11" class="mono" letter-spacing="1.8">ENGINEERED TO EXPLORE</text>
      ${orbitalSystem(1000, 267, 0.9)}
      <text x="1000" y="464" fill="#9caac3" font-size="10" class="mono" letter-spacing="2" text-anchor="middle">CURIOSITY / NO UPPER LIMIT</text>
      <path d="M52 488H1228" stroke="#657a9d" stroke-opacity=".3"/>
      <text x="56" y="523" fill="#8cebd1" font-size="11" class="mono" letter-spacing="1.3">01 / CLOUD NATIVE</text>
      <text x="56" y="549" fill="#a5b3ca" font-size="15">Azure. Infrastructure. Connected systems.</text>
      <path d="M452 512V551" stroke="#657a9d" stroke-opacity=".25"/>
      <text x="480" y="523" fill="#aeb4ff" font-size="11" class="mono" letter-spacing="1.3">02 / AGENTIC AI</text>
      <text x="480" y="549" fill="#a5b3ca" font-size="15">Intelligence with a deployment plan.</text>
      <path d="M858 512V551" stroke="#657a9d" stroke-opacity=".25"/>
      <text x="886" y="523" fill="#f0bc96" font-size="11" class="mono" letter-spacing="1.3">03 / QUANTUM</text>
      <text x="886" y="549" fill="#a5b3ca" font-size="15">A different way to think.</text>`;
  return document(width, height, 'CHAPI.DEV / Build the unexpected',
    'Antonio Chapinal Reyes. Cloud, AI and quantum computing. An original wireframe planet with slowly orbiting signals. Animation respects reduced-motion preferences.',
    `<rect width="${width}" height="${height}" fill="url(#grid)"/>${stars(width, height)}${content}`);
}

function card({ number, category, lines, accent, art, note }) {
  return document(600, 260, `${category} / ${lines.join(' ')}`, note,
    `<rect width="600" height="260" fill="url(#grid)"/>
    <ellipse cx="495" cy="130" rx="210" ry="195" fill="url(#card-glow)"/>
    <path d="M28 52H51" stroke="${accent}" stroke-width="2"/>
    <text x="62" y="56" fill="${accent}" font-size="11" class="mono" letter-spacing="1.4">${category}</text>
    <text x="28" y="122" fill="#f1f5ff" font-size="34" font-weight="750" letter-spacing="-1">${lines[0]}</text>
    <text x="28" y="165" fill="#f1f5ff" font-size="34" font-weight="750" letter-spacing="-1">${lines[1]}</text>
    <text x="30" y="229" fill="#8d9cb7" font-size="11" class="mono" letter-spacing="1.6">EXPERIMENT ${number}</text>
    <path d="M554 222H573 M565 214L573 222L565 230" stroke="${accent}" stroke-width="1.5"/>
    ${art}`,
    `<radialGradient id="card-glow"><stop stop-color="${accent}" stop-opacity=".13"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>`);
}

const agentArt = `<g transform="translate(463 137)">
  <path d="M-60 -51L0 0L60 -51 M-60 51L0 0L60 51" stroke="#81e8cd" stroke-opacity=".5" stroke-width="1.5"/>
  <path d="M-60 -51H60V51H-60Z" stroke="#81e8cd" stroke-opacity=".17" stroke-dasharray="3 7"/>
  ${[[-60, -51], [60, -51], [-60, 51], [60, 51]].map(([x, y]) => `<rect x="${x - 13}" y="${y - 13}" width="26" height="26" rx="7" fill="#102c2c" stroke="#83d9cb" stroke-opacity=".7"/><circle cx="${x}" cy="${y}" r="3" fill="#9cf6dd"/>`).join('')}
  <rect x="-24" y="-24" width="48" height="48" rx="13" fill="#102a2b" stroke="#96ffe1"/>
  <path d="M-10 0H10 M0 -10V10" stroke="#bcfff0" stroke-width="2"/>
  <circle r="37" stroke="#87f3d0" stroke-opacity=".25" stroke-dasharray="2 6" class="orbit"/>
</g>`;

const cloudArt = `<g transform="translate(463 139)">
  <path d="M0 -71L73 -28V50L0 91L-73 50V-28Z" stroke="#79c8ff" stroke-opacity=".22" stroke-dasharray="4 7"/>
  <path d="M0 -51L46 -25V27L0 53L-46 27V-25Z" fill="#0e2238" stroke="#7abffa" stroke-opacity=".65"/>
  <path d="M0 -51V0 M-46 -25L0 0L46 -25 M0 0V53" stroke="#8dd8ff" stroke-opacity=".3"/>
  <rect x="-21" y="-9" width="42" height="36" rx="8" fill="#101c31" stroke="#9cd7ff" stroke-width="1.5"/>
  <path d="M-11 -9V-18A11 11 0 0 1 11 -18V-9" stroke="#9cd7ff" stroke-width="2"/>
  <circle cy="6" r="3" fill="#bbebff"/><path d="M0 9V15" stroke="#bbebff" stroke-width="2"/>
  <circle cy="-71" r="4" fill="#99d8ff"/><circle cx="-73" cy="50" r="4" fill="#99d8ff"/><circle cx="73" cy="50" r="4" fill="#99d8ff"/>
</g>`;

const quantumArt = `<g transform="translate(465 137)">
  <circle r="65" fill="#1c1738" fill-opacity=".7" stroke="#bfa6ff" stroke-opacity=".65"/>
  <ellipse rx="65" ry="20" stroke="#bba4ff" stroke-opacity=".5" transform="rotate(-25)"/>
  <ellipse rx="22" ry="65" stroke="#bba4ff" stroke-opacity=".5" transform="rotate(-25)"/>
  <path d="M0 -88V88 M-82 38L82 -38" stroke="#ad9bda" stroke-opacity=".3"/>
  <path d="M0 0L29 -49 M20 -45L29 -49L30 -39" stroke="#dfcdff" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="29" cy="-49" r="5" fill="#dcc5ff"/><circle r="3" fill="#dcc5ff"/>
  <text x="8" y="-78" fill="#cebeed" font-size="14" class="mono">|0&gt;</text>
  <text x="8" y="96" fill="#cebeed" font-size="14" class="mono">|1&gt;</text>
  <circle r="77" stroke="#c1a4ff" stroke-opacity=".2" stroke-dasharray="2 8" class="reverse"/>
</g>`;

const devsecopsArt = `<g transform="translate(463 138)">
  <path d="M0 -73L58 -49V-3C58 35 27 59 0 76C-27 59 -58 35 -58 -3V-49Z" fill="#2a1c24" stroke="#f1b08a" stroke-opacity=".65"/>
  <path d="M0 -58L45 -39V-3C45 26 23 46 0 61C-23 46 -45 26 -45 -3V-39Z" stroke="#f1b08a" stroke-opacity=".18"/>
  <path d="M-22 -1L-6 15L25 -17" stroke="#ffd1ab" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M-88 -32H-58 M58 -32H88 M-88 30H-48 M48 30H88" stroke="#e9a47e" stroke-opacity=".5"/>
  <circle cx="-88" cy="-32" r="4" fill="#ffc297"/><circle cx="88" cy="-32" r="4" fill="#ffc297"/>
  <circle cx="-88" cy="30" r="4" fill="#ffc297"/><circle cx="88" cy="30" r="4" fill="#ffc297"/>
</g>`;

const cards = [
  { file: 'project-agents.svg', number: '01', category: 'AGENT SYSTEMS', lines: ['AI THAT', 'LEAVES THE LAB.'], accent: '#8bf0d0', art: agentArt, note: 'One agent, four deployment architectures. A connected graph of four runtimes around an agent core.' },
  { file: 'project-cloud.svg', number: '02', category: 'PRIVATE BY DESIGN', lines: ['CLOUD WITHOUT', 'THE EXPOSURE.'], accent: '#96cfff', art: cloudArt, note: 'Private connectivity for Microsoft Fabric. A locked, connected infrastructure cube.' },
  { file: 'project-quantum.svg', number: '03', category: 'QUANTUM FIELD NOTES', lines: ['THINK IN', 'SUPERPOSITION.'], accent: '#c4a9ff', art: quantumArt, note: 'Quantum computing with Qiskit and Q#. A Bloch sphere with a quantum state vector.' },
  { file: 'project-devsecops.svg', number: '04', category: 'SOFTWARE SUPPLY CHAIN', lines: ['SHIP IT.', 'PROVE IT.'], accent: '#ffc09a', art: devsecopsArt, note: 'GitOps, signed artifacts and policy enforcement. A verified shield connected to a delivery pipeline.' },
];

await mkdir(assets, { recursive: true });
await Promise.all([
  writeFile(`${assets}hero.svg`, hero()),
  writeFile(`${assets}hero-mobile.svg`, hero(true)),
  ...cards.map(({ file, ...config }) => writeFile(`${assets}${file}`, card(config))),
  writeFile(`${assets}footer.svg`, document(1280, 140,
    'Stay curious. Build the next thing.',
    'CHAPI.DEV. End of transmission. An open invitation to keep exploring and building.',
    `<path d="M40 70H168 M1112 70H1240" stroke="#80e4ca" stroke-opacity=".3"/>
    <circle cx="40" cy="70" r="3" fill="#90f3d3" class="beacon"/>
    <circle cx="1240" cy="70" r="3" fill="#90f3d3"/>
    <text x="640" y="64" fill="#e1e9f8" text-anchor="middle" font-size="27" font-weight="650" letter-spacing="1">STAY CURIOUS. BUILD THE NEXT THING.</text>
    <text x="640" y="99" fill="#8597b5" text-anchor="middle" font-size="11" class="mono" letter-spacing="2.5">CHAPI.DEV / END OF TRANSMISSION</text>`)),
]);
console.log(`Generated ${cards.length + 3} original SVG assets in ${assets}`);
