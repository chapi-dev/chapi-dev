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
const routeButtons = missions.map((mission, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'route';
  button.setAttribute('aria-label', `Jump to ${mission.name}`);
  const number = document.createElement('small');
  number.textContent = `${String(index + 1).padStart(2, '0')} / ${mission.field.toUpperCase()}`;
  const name = document.createElement('strong');
  name.textContent = mission.name;
  button.append(number, name);
  button.addEventListener('click', () => jump(index));
  $('#route-list').append(button);
  return button;
});

function readout() {
  const state = plan.snapshot();
  const mission = missions[state.selected];
  $('#sequence').textContent = `${String(state.selected + 1).padStart(2, '0')} / ${String(missions.length).padStart(2, '0')}`;
  $('#mission-title').textContent = mission.name;
  $('#mission-field').textContent = mission.field;
  $('#mission-line').textContent = mission.line;
  $('#mission-description').textContent = mission.description;
  $('#surface-report').textContent = mission.note;
  $('#coordinates').textContent = mission.position.map(value => `${value >= 0 ? '+' : ''}${value.toFixed(0).padStart(3, '0')}`).join(' / ');
  $('#repository').href = repositoryUrl(mission);
  $('#view-label').textContent = `${String(state.selected + 1).padStart(2, '0')} / ${mission.name.toUpperCase()} APPROACH`;
  $('#view-hint').textContent = 'Drag to orbit. Scroll to approach.';
  routeButtons.forEach((button, index) => button.setAttribute('aria-current', String(index === state.selected)));
  const url = new URL(window.location.href);
  url.searchParams.set('destination', mission.id);
  history.replaceState(null, '', url);
}

function setPhase(value, text) {
  if (phase === value) return;
  phase = value;
  document.body.dataset.mode = value;
  $('#flight-state').textContent = text;
}

function jump(index) {
  const instant = !motion || !engine;
  const changed = plan.select(index, performance.now(), { instant, force: Boolean(engine?.chart) });
  if (!changed) return;
  $('#chart-toggle').setAttribute('aria-pressed', 'false');
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
    setPhase('arrival', 'Orbital hold - motion paused');
  }
}

function returnToOrbit() {
  const state = plan.cancel();
  engine?.arrive(state.active);
  $('#chart-toggle').setAttribute('aria-pressed', 'false');
  readout();
  setPhase('arrival', engine ? 'Orbital hold' : 'Static navigation');
}

function toggleChart() {
  if (!engine) return;
  if (engine.chart) {
    returnToOrbit();
    return;
  }
  plan.cancel();
  readout();
  engine.showChart();
  $('#view-label').textContent = 'STAR CHART / 06 SIGNALS';
  $('#view-hint').textContent = 'Choose a signal. Drag to rotate.';
  $('#chart-toggle').setAttribute('aria-pressed', 'true');
  setPhase('chart', 'Star chart - choose a signal');
}

function fallback() {
  engine?.dispose();
  engine = null;
  $('#canvas-host').replaceChildren();
  $('#fallback').hidden = false;
  $('#map-markers').hidden = true;
  $('#chart-toggle').disabled = true;
  $('#reset-view').disabled = true;
  document.body.dataset.renderer = 'fallback';
  plan.finish();
  setPhase('fallback', 'Static navigation - WebGL unavailable');
}

$('#next-jump').addEventListener('click', () => jump(plan.adjacent(1)));
$('#reset-view').addEventListener('click', returnToOrbit);
$('#chart-toggle').addEventListener('click', toggleChart);
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
  } else if (/^[1-6]$/.test(event.key)) {
    jump(Number(event.key) - 1);
  } else if (event.key.toLowerCase() === 'm') {
    toggleChart();
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    returnToOrbit();
  }
});

readout();
setMotion(motion);
try {
  engine = createUniverse($('#canvas-host'), { initial, onSelect: jump, onLost: fallback });
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
      if (!state.travelling && phase === 'transit') setPhase('arrival', 'Orbital hold');
    }
    $('#jump-progress').style.setProperty('--progress', String(state.travelling ? state.progress : 0));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('pagehide', event => { if (!event.persisted) engine?.dispose(); });
