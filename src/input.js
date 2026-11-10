export class InputError extends Error {}
const fail = message => { throw new InputError(message); };
function number(value, name, fallback, min, max, integer = false) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a number`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) fail(`${name} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}`);
  return n;
}
function boolean(value, name, fallback = false) {
  if (value === undefined) return fallback;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  fail(`${name} must be true or false`);
}
function color(value, name, fallback) {
  if (value === undefined) return fallback;
  if (!/^#?(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) fail(`${name} must be a hex color (e.g. aaa or %23aaaaaa)`);
  return value.startsWith('#') ? value : `#${value}`;
}
const archKeys = ['min_nrows', 'span_angle', 'seat_radius_factor', 'filling_strategy', 'denser_rows', 'canvas_size', 'margins', 'write_number_of_seats', 'font_size_factor'];
const westKeys = ['wingrows', 'cozy', 'fullwidth', 'centercols', 'radius', 'spacing'];
const usPresets = [ ['democrats', 'Democrats', '#0000FF'], ['republicans', 'Republicans', '#FF0000'], ['independents', 'Independents', '#C9C9C9'], ['vacant', 'Vacant', '#6B6B6B'] ];
export function parseInput(params, chart) {
  const raw = Object.create(null);
  const indexed = new Map();
  const allowed = chart === 'westminster' ? westKeys : archKeys;
  for (const [key, value] of params) {
    if (Object.hasOwn(raw, key)) fail(`Duplicate parameter: ${key}`);
    raw[key] = value;
    const match = /^party([1-9]\d*)_(color|size|name|group|border_size|border_color)$/.exec(key);
    if (match) {
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id) || id > 100) fail('Party indices must be between 1 and 100');
      if (!indexed.has(id)) indexed.set(id, {});
      indexed.get(id)[match[2]] = value;
    } else if (!allowed.includes(key) && !(chart === 'us' && usPresets.some(([name]) => key === name))) fail(`Unknown parameter: ${key}`);
  }
  if (chart === 'us' && usPresets.some(([key]) => raw[key] !== undefined)) {
    if (indexed.size) fail('Use either numbered parties or US preset counts, not both');
    usPresets.forEach(([key, name, color], i) => indexed.set(i + 1, { size: raw[key] ?? '0', name, color }));
  }
  if (!indexed.size) fail('Provide at least one party, e.g. party1_size=324&party1_color=aaa');
  const parties = [...indexed].sort(([a], [b]) => a - b).map(([id, p]) => {
    if (p.size === undefined) fail(`party${id}_size is required`);
    const name = p.name ?? `Party ${id}`;
    if (name.length > 200 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(name)) fail('Party names must be valid XML text of at most 200 characters');
    const group = p.group ?? (id % 2 ? 'left' : 'right');
    if (!['left', 'right', 'center', 'head'].includes(group)) fail(`party${id}_group must be left, right, center, or head`);
    if (chart !== 'westminster' && p.group !== undefined) fail('party groups apply only to Westminster');
    if (chart === 'westminster' && (p.border_size !== undefined || p.border_color !== undefined)) fail('Party borders apply only to arch and US diagrams');
    return { name, group, size: number(p.size, `party${id}_size`, 0, 0, 10000, true), color: color(p.color, `party${id}_color`, '#aaa'), border_size: number(p.border_size, `party${id}_border_size`, 0, 0, 1), border_color: color(p.border_color, `party${id}_border_color`, '#000') };
  });
  const total = parties.reduce((n, p) => n + p.size, 0);
  if (total < 1 || total > 10000) fail('Total seat count must be between 1 and 10000');
  const n = (key, fallback, min, max, integer = false) => number(raw[key], key, fallback, min, max, integer);
  const b = (key, fallback) => boolean(raw[key], key, fallback);
  let options;
  if (chart === 'westminster') options = { wingrows: n('wingrows', 0, 1, 100, true), centercols: n('centercols', 0, 1, 100, true), cozy: b('cozy'), fullwidth: b('fullwidth'), radius: n('radius', 0, 0, 0.5), spacing: n('spacing', 0.1, 0, 0.9) };
  else {
    const strategy = raw.filling_strategy ?? (b('denser_rows') ? 'empty_inner' : 'default');
    if (raw.denser_rows !== undefined && raw.filling_strategy !== undefined) fail('Use either denser_rows or filling_strategy');
    if (!['default', 'empty_inner', 'outer_priority'].includes(strategy)) fail('filling_strategy must be default, empty_inner, or outer_priority');
    options = { min_nrows: n('min_nrows', 0, 0, 100, true), span_angle: n('span_angle', 180, 10, 180), seat_radius_factor: n('seat_radius_factor', 0.8, 0.01, 1), filling_strategy: strategy, canvas_size: n('canvas_size', 175, 10, 2000), margins: n('margins', 5, 0, 200), write_number_of_seats: b('write_number_of_seats', true), font_size_factor: n('font_size_factor', 36 / 175, 0.01, 1) };
  }
  return { parties: parties.filter(p => p.size > 0), options };
}
