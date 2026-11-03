import { missions, repositoryUrl, missionFromLocation } from './missions.js';
import { createFlightPlan } from './navigation.js';
import { createUniverse } from './universe.js';

const $ = selector => document.querySelector(selector);
const initial = missionFromLocation(window.location.href);
const plan = createFlightPlan(missions.length, initial);
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
let motion = !preference.matches;
let engine = null;
let previousTime = performance.now();
let phase = '';
let selectedMoon = -1;
const surveyed = new Set([initial]);

const routeButtons = missions.map((mission, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'route';
  button.setAttribute('aria-label', `Jump to ${mission.name}`);
  const number = document.createElement('small');
  number.textContent = `${String(index + 1).padStart(2, '0')} / ${mission.field.toUpperCase()}`;
  const name = document.createElement('strong');
  const label = document.createElement('span');
  label.textContent = mission.name;
  const dot = document.createElement('span');
  dot.className = 'route-dot';
  dot.setAttribute('aria-hidden', 'true');
  name.append(label, dot);
  button.append(number, name);
  button.addEventListener('click', () => jump(index));
  $('#route-list').append(button);
  return button;
});

const radarSvg = $('#radar-svg');
const radarNodes = [];
let radarPulse = null;
if (radarSvg) {
  const ns = 'http://www.w3.org/2000/svg';
  for (const r of [260, 520, 780]) {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '-720');
    circle.setAttribute('r', String(r));
    circle.setAttribute('class', 'radar-grid');
    radarSvg.append(circle);
  }
  const lane = document.createElementNS(ns, 'polyline');
  lane.setAttribute('points', missions.map(m => `${m.position[0]},${m.position[2]}`).join(' '));
  lane.setAttribute('class', 'radar-lane');
  radarSvg.append(lane);

  radarPulse = document.createElementNS(ns, 'circle');
  radarPulse.setAttribute('r', '64');
  radarPulse.setAttribute('class', 'radar-pulse');
  radarSvg.append(radarPulse);

  missions.forEach((mission, idx) => {
    const node = document.createElementNS(ns, 'circle');
    node.setAttribute('cx', String(mission.position[0]));
    node.setAttribute('cy', String(mission.position[2]));
    node.setAttribute('r', '26');
    node.setAttribute('class', 'radar-node');
    node.addEventListener('click', () => jump(idx));
    radarSvg.append(node);
    radarNodes.push(node);
  });
}

function updateSurveyStatus(activeIndex) {
  surveyed.add(activeIndex);
  const countText = `${String(surveyed.size).padStart(2, '0')} / ${String(missions.length).padStart(2, '0')}`;
  if ($('#survey-count')) $('#survey-count').textContent = countText;
  routeButtons.forEach((btn, idx) => {
    btn.dataset.surveyed = String(surveyed.has(idx));
  });
}

function renderSatellites(mission) {
  const host = $('#moon-list');
  if (!host) return;
  host.replaceChildren();
  const moons = mission.moons || [];
  if ($('#satellite-count')) {
    $('#satellite-count').textContent = `${String(moons.length).padStart(2, '0')} ${moons.length === 1 ? 'MOON' : 'MOONS'}`;
  }
  moons.forEach((moon, moonIdx) => {
    const card = document.createElement('div');
    card.className = 'moon-card';
    card.dataset.active = String(selectedMoon === moonIdx);

    const focusBtn = document.createElement('button');
    focusBtn.type = 'button';
    focusBtn.className = 'moon-focus';
    focusBtn.setAttribute('aria-label', `Inspect moon ${moon.name}`);
    const title = document.createElement('strong');
    title.textContent = `◐ ${moon.name}`;
    const sub = document.createElement('small');
    sub.textContent = `${moon.role} · ${moon.tech}`;
    focusBtn.append(title, sub);
    focusBtn.addEventListener('click', () => selectMoon(moonIdx));

    const link = document.createElement('a');
    link.className = 'moon-repo';
    link.href = repositoryUrl(moon.repo);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Repo ↗';
    link.setAttribute('aria-label', `Open ${moon.name} repository (${moon.repo})`);

    card.append(focusBtn, link);
    host.append(card);
  });
}

function readout() {
  const state = plan.snapshot();
  const mission = missions[state.selected];
  updateSurveyStatus(state.selected);
  $('#sequence').textContent = `${String(state.selected + 1).padStart(2, '0')} / ${String(missions.length).padStart(2, '0')}`;
  $('#mission-title').textContent = mission.name;
  $('#mission-field').textContent = mission.field;
  $('#mission-line').textContent = mission.line;
  $('#mission-description').textContent = mission.description;
  $('#surface-report').textContent = mission.note;
  $('#coordinates').textContent = mission.position.map(value => `${value >= 0 ? '+' : ''}${value.toFixed(0).padStart(3, '0')}`).join(' / ');
  if ($('#biome-stats') && mission.telemetry) {
    $('#biome-stats').textContent = `${mission.telemetry.gravity} · ${mission.telemetry.temp} · ${mission.telemetry.sector}`;
  }
  if ($('#hud-sector') && mission.telemetry) {
    $('#hud-sector').textContent = mission.telemetry.sector;
  }
  const activeMoon = selectedMoon >= 0 ? mission.moons?.[selectedMoon] : null;
  $('#repository').href = repositoryUrl(activeMoon ? activeMoon.repo : mission);
  if ($('#repository-label')) {
    $('#repository-label').textContent = activeMoon ? `Open ${activeMoon.name} repo` : 'Open flagship repository';
  }
  $('#view-label').textContent = activeMoon
    ? `${String(state.selected + 1).padStart(2, '0')} / ${mission.name.toUpperCase()} · ${activeMoon.name.toUpperCase()}`
    : `${String(state.selected + 1).padStart(2, '0')} / ${mission.name.toUpperCase()} APPROACH`;
  $('#view-hint').textContent = 'Drag to orbit. Scroll to approach. F to scan.';

  if ($('#tech-tags')) {
    $('#tech-tags').replaceChildren(...(mission.stack || []).map(tag => {
      const span = document.createElement('span');
      span.className = 'tech-tag';
      span.textContent = tag;
      return span;
    }));
  }
  renderSatellites(mission);

  routeButtons.forEach((button, index) => button.setAttribute('aria-current', String(index === state.selected)));
  radarNodes.forEach((node, index) => node.setAttribute('data-active', String(index === state.selected)));
  if (radarPulse) {
    radarPulse.setAttribute('cx', String(mission.position[0]));
    radarPulse.setAttribute('cy', String(mission.position[2]));
  }
  const url = new URL(window.location.href);
  url.searchParams.set('destination', mission.id);
  history.replaceState(null, '', url);
}

function setPhase(value, text) {
  if (phase === value && $('#flight-state').textContent === text) return;
  phase = value;
  document.body.dataset.mode = value;
  $('#flight-state').textContent = text;
}

function selectMoon(moonIndex) {
  if (selectedMoon === moonIndex) {
    returnToOrbit();
    return;
  }
  selectedMoon = moonIndex;
  engine?.focusMoon(moonIndex);
  if ($('#scan-badge')) $('#scan-badge').textContent = 'MOON LOCK';
  readout();
  setPhase('arrival', 'Satellite orbital lock');
}

function triggerSurfaceScan() {
  if (!engine) return;
  engine.triggerScan();
  if ($('#scan-toggle')) $('#scan-toggle').setAttribute('aria-pressed', 'true');
  if ($('#scan-badge')) $('#scan-badge').textContent = 'SURFACE SURVEYED';
  setPhase('arrival', 'Deep geological & repo scan');
  setTimeout(() => {
    if ($('#scan-toggle')) $('#scan-toggle').setAttribute('aria-pressed', 'false');
  }, 1600);
}

function jump(index) {
  const instant = !motion || !engine;
  const changed = plan.select(index, performance.now(), { instant, force: Boolean(engine?.chart || selectedMoon >= 0) });
  if (!changed) return;
  selectedMoon = -1;
  $('#chart-toggle').setAttribute('aria-pressed', 'false');
  if ($('#scan-badge')) $('#scan-badge').textContent = instant ? 'ORBIT LOCKED' : 'HYPERDRIVE';
  if (instant) engine?.arrive(index);
  else engine.beginJump(index);
  readout();
  setPhase(instant ? 'arrival' : 'transit', instant ? (engine ? 'Orbital hold' : 'Static navigation') : 'Intergalactic transit');
}

function setMotion(value) {
  motion = value;
  $('#motion-toggle').setAttribute('aria-pressed', String(motion));
  $('#motion-toggle').textContent = motion ? 'Motion on' : 'Motion off';
  document.body.dataset.motion = motion ? 'on' : 'off';
  if (!motion && plan.snapshot().travelling) {
    const state = plan.finish();
    engine?.arrive(state.active);
    if ($('#scan-badge')) $('#scan-badge').textContent = 'ORBIT LOCKED';
    setPhase('arrival', 'Orbital hold - motion paused');
  }
}

function returnToOrbit() {
  selectedMoon = -1;
  const state = plan.cancel();
  engine?.arrive(state.active);
  $('#chart-toggle').setAttribute('aria-pressed', 'false');
  if ($('#scan-badge')) $('#scan-badge').textContent = 'ORBIT LOCKED';
  readout();
  setPhase('arrival', engine ? 'Orbital hold' : 'Static navigation');
}

function toggleChart() {
  if (!engine) return;
  if (engine.chart) {
    returnToOrbit();
    return;
  }
  selectedMoon = -1;
  plan.cancel();
  readout();
  engine.showChart();
  $('#view-label').textContent = `STAR CHART / 0${missions.length} SIGNALS`;
  $('#view-hint').textContent = 'Choose a signal. Drag to rotate.';
  $('#chart-toggle').setAttribute('aria-pressed', 'true');
  if ($('#scan-badge')) $('#scan-badge').textContent = '3D HOLOMAP';
  setPhase('chart', 'Star chart - choose a signal');
}

function fallback() {
  engine?.dispose();
  engine = null;
  $('#canvas-host').replaceChildren();
  $('#fallback').hidden = false;
  $('#map-markers').hidden = true;
  $('#chart-toggle').disabled = true;
  if ($('#scan-toggle')) $('#scan-toggle').disabled = true;
  $('#reset-view').disabled = true;
  document.body.dataset.renderer = 'fallback';
  plan.finish();
  setPhase('fallback', 'Static navigation - WebGL unavailable');
}

$('#next-jump').addEventListener('click', () => jump(plan.adjacent(1)));
$('#reset-view').addEventListener('click', returnToOrbit);
$('#chart-toggle').addEventListener('click', toggleChart);
$('#scan-toggle')?.addEventListener('click', triggerSurfaceScan);
$('#motion-toggle').addEventListener('click', () => setMotion(!motion));
$('#help-toggle').addEventListener('click', () => $('#controls-dialog').showModal());
$('#theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  engine?.theme();
});
preference.addEventListener('change', event => setMotion(!event.matches));

window.addEventListener('keydown', event => {
  const tag = document.activeElement?.tagName;
  if ($('#controls-dialog').open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    jump(plan.adjacent(event.key === 'ArrowRight' ? 1 : -1));
  } else if (/^[1-8]$/.test(event.key)) {
    const targetIdx = Number(event.key) - 1;
    if (targetIdx < missions.length) jump(targetIdx);
  } else if (event.key.toLowerCase() === 'm') {
    toggleChart();
  } else if (event.key.toLowerCase() === 'f') {
    triggerSurfaceScan();
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    returnToOrbit();
  }
});

readout();
setMotion(motion);
try {
  engine = createUniverse($('#canvas-host'), {
    initial,
    onSelect: jump,
    onMoonSelect: selectMoon,
    onOpenRepo: idx => {
      const activeMoon = selectedMoon >= 0 ? missions[idx].moons?.[selectedMoon] : null;
      window.open(repositoryUrl(activeMoon ? activeMoon.repo : missions[idx]), '_blank', 'noopener,noreferrer');
    },
    onTelemetry: data => {
      if ($('#hud-heading')) $('#hud-heading').textContent = `${String(data.heading).padStart(3, '0')}°`;
      if ($('#hud-altitude')) $('#hud-altitude').textContent = `${data.altitude} Mm`;
      if ($('#hud-speed')) $('#hud-speed').textContent = data.speed;
    },
    onLost: fallback,
  });
  engine.theme();
  document.body.dataset.renderer = 'webgl';
  setPhase('arrival', 'Orbital hold');
} catch (error) {
  console.warn('3D view unavailable:', error.message);
  fallback();
}

function frame(now) {
  const delta = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  if (document.visibilityState !== 'hidden') {
    const state = plan.tick(now);
    if (engine) {
      engine.frame(now, delta, state, motion);
      if (!state.travelling && phase === 'transit') {
        if ($('#scan-badge')) $('#scan-badge').textContent = 'ORBIT LOCKED';
        setPhase('arrival', 'Orbital hold');
      }
    }
    $('#jump-progress').style.setProperty('--progress', String(state.travelling ? state.progress : 0));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('pagehide', event => { if (!event.persisted) engine?.dispose(); });
