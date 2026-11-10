// Translated from src/westminster.py in slashme/parliamentdiagram (BSD-3-Clause).
import { header, group, mod, roundEven } from './svg.js';
export function westminsterSeats(parties, options) {
  const areas = ['head', 'left', 'right', 'center'];
  const counts = Object.fromEntries(areas.map(area => [area, parties.filter(p => p.group === area).reduce((n, p) => n + p.size, 0)]));
  const gaps = new Map(parties.map(p => [p, 0]));
  const empty = { left: 0, right: 0 };
  const defaultRows = options.wingrows || Math.ceil(Math.sqrt(Math.max(1, counts.left, counts.right) / 20)) * 2;
  const rows = { left: defaultRows, right: defaultRows };
  if (!options.cozy) {
    for (const wing of ['left', 'right']) for (const p of parties.filter(p => p.group === wing)) {
      gaps.set(p, mod(-p.size, rows[wing]));
      empty[wing] += gaps.get(p);
    }
  }
  const cols = Math.ceil(Math.max(counts.left + empty.left, counts.right + empty.right) / defaultRows);
  if (options.fullwidth && cols > 0) {
    for (const wing of ['left', 'right']) {
      if (options.cozy) rows[wing] = Math.ceil(counts[wing] / cols);
      else for (let i = rows[wing]; i > 1; i--) {
        const members = parties.filter(p => p.group === wing);
        const temp = members.map(p => mod(-p.size, i - 1));
        const total = temp.reduce((a, b) => a + b, 0);
        if (counts[wing] + total > cols * (i - 1)) break;
        empty[wing] = total;
        rows[wing] = i - 1;
        members.forEach((p, j) => gaps.set(p, temp[j]));
      }
    }
  }
  const centerCols = options.centercols || Math.ceil(Math.sqrt(counts.center / 4));
  const centerRows = centerCols ? Math.ceil(counts.center / centerCols) : 0;
  const offset = counts.head ? 1 : 0;
  let totalCols = counts.head ? Math.max(cols + 1, counts.head) : cols;
  if (counts.center) totalCols += 1 + centerCols;
  const totalRows = Math.max(rows.left + rows.right + 2, centerRows);
  const block = 350 / Math.max(totalCols, totalRows);
  const side = block * (1 - options.spacing);
  const width = block * totalCols + 10;
  const height = block * totalRows + 10;
  const top = height / 2 - side / 2 + (rows.left - rows.right) * block / 2;
  const positions = Object.fromEntries(areas.map(area => [area, []]));
  for (let x = 0; x < counts.head; x++) positions.head.push([5 + block * (x + options.spacing / 2), top]);
  for (let x = 0; x < centerCols; x++) {
    const thisCol = Math.min(centerRows, counts.center - x * centerRows);
    for (let y = 0; y < thisCol; y++) positions.center.push([width - 5 - (centerCols - x + options.spacing / 2) * block, (height - thisCol * block) / 2 + block * (y + options.spacing / 2)]);
  }
  positions.center.sort((a, b) => a[1] - b[1]);
  for (let x = 0; x < cols; x++) for (const wing of ['left', 'right']) for (let y = 0; y < rows[wing]; y++) {
    positions[wing].push([5 + (offset + x + options.spacing / 2) * block, top + (wing === 'left' ? -1 : 1) * (1.5 + y) * block]);
  }
  for (const wing of ['left', 'right']) {
    const points = positions[wing];
    const sortY = (a, b) => (wing === 'right' ? 1 : -1) * (a[1] - b[1]);
    if (options.fullwidth && rows[wing] > 1) {
      points.sort(sortY);
      if (options.cozy) positions[wing] = points.slice(0, counts[wing]);
      else {
        points.sort((a, b) => a[0] - b[0]);
        let counter = 0;
        let total = counts[wing] + empty[wing];
        let extras = rows[wing] * cols - total;
        for (const p of parties.filter(p => p.group === wing)) {
          const spots = p.size + gaps.get(p);
          let add = total ? roundEven(extras * spots / total) : 0;
          add += mod(-add, rows[wing]);
          const slice = points.slice(counter, counter + spots + add);
          extras -= add;
          total -= spots + add;
          if (counter < (counts[wing] + empty[wing]) / 2) slice.sort((a, b) => b[0] - a[0]);
          slice.sort(sortY);
          for (const point of slice.slice(p.size)) points.splice(points.indexOf(point), 1);
          counter += spots + add;
        }
      }
    }
    // Upstream cozy/fullwidth assigns in row order, from the aisle outward.
    points.sort((a, b) => a[0] - b[0]);
  }
  return { positions, rows, side, radius: options.radius * side, width, height };
}
export function renderWestminster(parties, options) {
  const { positions, rows, side, radius, width, height } = westminsterSeats(parties, options);
  let svg = header(width, height, 'Westminster parliament diagram');
  for (const area of ['head', 'left', 'right', 'center']) {
    let offset = 0;
    parties.forEach((p, index) => {
      if (p.group !== area) return;
      const body = positions[area].slice(offset, offset + p.size).map(([x, y]) => `<rect x="${x.toFixed(4)}" y="${y.toFixed(4)}" width="${side.toFixed(4)}" height="${side.toFixed(4)}" rx="${radius.toFixed(4)}"/>`).join('');
      svg += group(p, index, body);
      offset += p.size;
      if (['left', 'right'].includes(area) && !options.cozy && !options.fullwidth) offset += mod(-p.size, rows[area]);
    });
  }
  return svg + '</svg>\n';
}
