export function createFlightPlan(count, initial = 0, duration = 1800) {
  if (!Number.isInteger(count) || count < 1 || initial < 0 || initial >= count) {
    throw new RangeError('A flight plan needs a valid initial destination.');
  }
  let active = initial;
  let selected = initial;
  let started = 0;
  let travelling = false;

  function snapshot(now = started) {
    const progress = travelling ? Math.max(0, Math.min(1, (now - started) / duration)) : 1;
    return { active, selected, travelling, progress };
  }

  return {
    snapshot,
    select(index, now, { instant = false, force = false } = {}) {
      if (!Number.isInteger(index) || index < 0 || index >= count) {
        throw new RangeError('Unknown destination.');
      }
      if (selected === index && !force) return false;
      selected = index;
      started = now;
      travelling = !instant;
      if (instant) active = selected;
      return true;
    },
    tick(now) {
      if (travelling && now - started >= duration) {
        active = selected;
        travelling = false;
      }
      return snapshot(now);
    },
    finish() {
      active = selected;
      travelling = false;
      return snapshot();
    },
    cancel() {
      selected = active;
      travelling = false;
      return snapshot();
    },
    adjacent(direction) {
      return (selected + direction % count + count) % count;
    },
  };
}

export function easeFlight(progress) {
  const value = Math.max(0, Math.min(1, progress));
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}
