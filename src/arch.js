// Geometry translated from parliamentarch 1.1.2 (BSD-3-Clause).
import { header, group, roundEven } from './svg.js';
const thickness = rows => 1 / (4 * rows - 2);
function capacities(rows, span) {
  const radius = thickness(rows);
  return Array.from({ length: rows }, (_, r) => Math.trunc(Math.PI * span / 180 * (0.5 + 2 * r * radius) / (2 * radius)));
}
const sum = values => values.reduce((a, b) => a + b, 0);
function minimumRows(count, span) {
  let rows = 1;
  while (sum(capacities(rows, span)) < count) rows++;
  return rows;
}
export function archSeats(count, options) {
  const { span_angle: span, min_nrows: minRows, filling_strategy: strategy } = options;
  const rows = Math.max(minRows, minimumRows(count, span));
  const thick = thickness(rows);
  const maxed = capacities(rows, span);
  let start = 0;
  if (strategy !== 'default') {
    while (start < rows - 1 && sum(maxed.slice(start + 1)) >= count) start++;
  }
  const ratio = count / sum(maxed.slice(start));
  const positions = [];
  for (let r = start; r < rows; r++) {
    const n = r === rows - 1 ? count - positions.length
      : strategy === 'outer_priority' ? (r === start ? count - sum(maxed.slice(r + 1)) : maxed[r])
        : roundEven(ratio * maxed[r]);
    const radius = 0.5 + 2 * r * thick;
    if (n === 1) positions.push({ x: 1, y: radius, angle: Math.PI / 2 });
    else if (n > 1) {
      const margin = Math.asin(thick / radius) + (1 - span / 180) * Math.PI / 2;
      const increment = (Math.PI - 2 * margin) / (n - 1);
      for (let s = 0; s < n; s++) {
        const angle = margin + s * increment;
        positions.push({ x: radius * Math.cos(angle) + 1, y: radius * Math.sin(angle), angle });
      }
    }
  }
  return positions.sort((a, b) => b.angle - a.angle);
}
export function renderArch(parties, options) {
  const count = sum(parties.map(p => p.size));
  const positions = archSeats(count, options);
  const canvas = options.canvas_size;
  const margin = options.margins;
  // Use the actual row count/span for radius so advanced layouts cannot overlap.
  const radius = options.seat_radius_factor * thickness(Math.max(options.min_nrows, minimumRows(count, options.span_angle))) * canvas;
  let svg = header(2 * canvas + 2 * margin, canvas + 2 * margin, `${count} seats`);
  if (options.write_number_of_seats) svg += `<text x="${canvas + margin}" y="${margin + canvas * 170 / 175}" text-anchor="middle" font-family="sans-serif" font-size="${roundEven(options.font_size_factor * canvas)}" font-weight="bold">${count}</text>\n`;
  let offset = 0;
  parties.forEach((party, index) => {
    const stroke = party.border_size * radius;
    const body = positions.slice(offset, offset + party.size).map(({ x, y }) => `<circle cx="${(margin + canvas * x).toFixed(4)}" cy="${(margin + canvas * (1 - y)).toFixed(4)}" r="${(radius - stroke / 2).toFixed(4)}" stroke="${party.border_color}" stroke-width="${stroke.toFixed(4)}"/>`).join('');
    svg += group(party, index, body);
    offset += party.size;
  });
  return svg + '</svg>\n';
}
