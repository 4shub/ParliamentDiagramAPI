import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/server.js';
import { parseInput } from '../src/input.js';
import { archSeats } from '../src/arch.js';
import { westminsterSeats, renderWestminster } from '../src/westminster.js';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/python-geometry.json', import.meta.url)));
const defaults = chart => parseInput(new URLSearchParams('party1_size=1'), chart).options;
function close(actual, expected) {
  if (Array.isArray(expected)) {
    assert.equal(actual.length, expected.length);
    expected.forEach((v, i) => close(actual[i], v));
  } else assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}
test('arch seat coordinates match Python parliamentarch 1.1.2', () => {
  for (const f of fixtures.arch) {
    const points = archSeats(f.count, { ...defaults('arch'), ...f.options });
    close(points.map(p => [p.x, p.y]), f.positions);
  }
});
test('Westminster seat coordinates match upstream Python across layout modes', () => {
  for (const f of fixtures.westminster) {
    const result = westminsterSeats(f.parties, { ...defaults('westminster'), ...f.options });
    for (const area of ['head', 'left', 'right', 'center']) close(result.positions[area], f.positions[area]);
    close([result.width, result.height, result.side], [f.width, f.height, f.side]);
  }
});
test('Westminster always renders the exact number of seats in bounds', () => {
  for (const cozy of [false, true]) for (const fullwidth of [false, true]) {
    for (let seed = 1; seed <= 60; seed++) {
      const parties = [1, 2, 3, 4, 5].map((n, i) => ({ name: `P${i}`, size: (seed * n * 17) % 91 + 1, group: i < 3 ? 'left' : 'right', color: '#aaa' }));
      const options = { ...defaults('westminster'), cozy, fullwidth };
      const layout = westminsterSeats(parties, options);
      const svg = renderWestminster(parties, options);
      for (const match of svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)) {
        const [x, y, width, height] = match.slice(1).map(Number);
        assert.ok(x >= 0 && y >= 0 && x + width <= layout.width + 0.001 && y + height <= layout.height + 0.001);
      }
      const total = parties.reduce((n, p) => n + p.size, 0);
      assert.equal((svg.match(/<rect /g) ?? []).length, total, `seed=${seed}, cozy=${cozy}, fullwidth=${fullwidth}`);
    }
  }
});
test('HTTP API returns SVGs, useful errors, headers, and escaped names', async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const chart of ['arch', 'us', 'westminster']) {
    const response = await fetch(`${base}/${chart}?party1_size=324&party1_color=%23aaa&party2_size=25&party2_color=123456`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/svg\+xml/);
    const svg = await response.text();
    assert.equal((svg.match(/<(?:circle|rect) /g) ?? []).length, 349);
    assert.doesNotMatch(svg, /NaN|Infinity/);
  }
  const info = await (await fetch(base)).json();
  assert.deepEqual(info.endpoints, ['/arch.svg', '/us.svg', '/westminster.svg']);
  for (const example of Object.values(info.examples)) {
    const response = await fetch(base + example);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<svg /);
  }
  const us = await (await fetch(`${base}/us?democrats=48&republicans=50&independents=2`)).text();
  assert.equal((us.match(/<circle /g) ?? []).length, 100);
  assert.match(us, /fill="#0000FF"/);
  const escaped = await (await fetch(`${base}/arch?party1_size=1&party1_name=${encodeURIComponent('<script>alert("x")</script>')}`)).text();
  assert.doesNotMatch(escaped, /<script>/);
  assert.match(escaped, /&lt;script&gt;/);
  for (const query of ['', 'party1_size=-1', 'party1_size=1.5', 'party1_size=Infinity', 'party1_size=10001', 'party1_size=0', 'party1_size=1&party1_color=red', 'party1_size=1&party1_size=2', 'party1_size=1&unknown=1', 'party1_size=1&span_angle=0', 'party1_size=1&min_nrows=100000', 'party1_color=aaa', 'party1_size=1&write_number_of_seats=maybe']) {
    const response = await fetch(`${base}/arch?${query}`);
    assert.equal(response.status, 400, query);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  for (const group of ['head', 'center']) {
    const svg = await (await fetch(`${base}/westminster?party1_size=3&party1_group=${group}&fullwidth=true&cozy=true`)).text();
    assert.equal((svg.match(/<rect /g) ?? []).length, 3);
    assert.doesNotMatch(svg, /NaN|Infinity/);
  }
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await fetch(`${base}/missing`)).status, 404);
  assert.equal((await fetch(`${base}/arch`, { method: 'POST' })).status, 405);
  const head = await fetch(`${base}/arch.svg?party1_size=5`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(`${base}/arch`, { method: 'OPTIONS' })).status, 204);
});
