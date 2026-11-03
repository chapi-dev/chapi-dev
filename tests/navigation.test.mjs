import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlightPlan, easeFlight } from '../web/navigation.js';

test('a later jump replaces an in-flight destination without a stale arrival', () => {
  const plan = createFlightPlan(6);
  plan.select(1, 0);
  assert.equal(plan.tick(900).progress, 0.5);
  plan.select(4, 900);
  assert.equal(plan.tick(1800).travelling, true);
  assert.equal(plan.snapshot().active, 0);
  assert.deepEqual(plan.tick(2700), { active: 4, selected: 4, travelling: false, progress: 1 });
});

test('abort returns to the last completed arrival, not an interrupted target', () => {
  const plan = createFlightPlan(6);
  plan.select(2, 0);
  plan.tick(1800);
  plan.select(5, 2000);
  plan.tick(2400);
  assert.deepEqual(plan.cancel(), { active: 2, selected: 2, travelling: false, progress: 1 });
});

test('rapid next/previous navigation follows the selected route and wraps', () => {
  const plan = createFlightPlan(6, 5);
  assert.equal(plan.adjacent(1), 0);
  plan.select(0, 0);
  assert.equal(plan.adjacent(1), 1);
  assert.equal(plan.adjacent(-1), 5);
});

test('reduced motion commits immediately and can finish a pending transit', () => {
  const plan = createFlightPlan(6);
  plan.select(3, 0, { instant: true });
  assert.equal(plan.snapshot().active, 3);
  assert.equal(plan.snapshot().travelling, false);
  plan.select(4, 50);
  assert.deepEqual(plan.finish(), { active: 4, selected: 4, travelling: false, progress: 1 });
});

test('flight easing stays at its endpoints rather than overshooting a world', () => {
  assert.equal(easeFlight(-0.2), 0);
  assert.equal(easeFlight(1.2), 1);
  assert.equal(easeFlight(0.5), 0.5);
  assert(easeFlight(0.25) < 0.25);
  assert(easeFlight(0.75) > 0.75);
});
