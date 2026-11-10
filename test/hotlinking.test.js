import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, readConfig } from '../src/server.js';

async function serve(t, config) {
  const server = createApp(config);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('hotlinking defaults on and supports CLI and environment toggles', () => {
  assert.equal(readConfig([], {}).allowHotlinking, true);
  assert.equal(readConfig(['--no-hotlinking'], {}).allowHotlinking, false);
  assert.equal(readConfig([], { ALLOW_HOTLINKING: 'false' }).allowHotlinking, false);
  assert.equal(readConfig(['--hotlinking'], { ALLOW_HOTLINKING: 'false' }).allowHotlinking, true);
  assert.throws(() => readConfig(['--hotlinking', '--no-hotlinking'], {}));
  assert.throws(() => readConfig([], { ALLOW_HOTLINKING: 'no' }));
  assert.throws(() => readConfig([], { PUBLIC_ORIGIN: 'https://example.com/path' }));
  assert.equal(readConfig([], { PUBLIC_ORIGIN: 'https://charts.example.com/' }).publicOrigin, 'https://charts.example.com');
});

test('enabled hotlinking serves external embeds with CORS and public caching', async t => {
  const base = await serve(t);
  const response = await fetch(`${base}/arch.svg?party1_size=3`, { headers: { Referer: 'https://external.example/page', 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
});

test('disabled hotlinking blocks external sources on all chart routes and aliases', async t => {
  const base = await serve(t, { allowHotlinking: false });
  for (const chart of ['arch', 'us', 'westminster']) for (const extension of ['', '.svg']) {
    for (const headers of [
      { Referer: 'https://external.example/page' },
      { Origin: 'https://external.example' },
      { Origin: 'null' },
      { Referer: 'invalid-url' },
      { Referer: `${base}.attacker.example/page` },
      { 'Sec-Fetch-Site': 'cross-site' },
      { 'Sec-Fetch-Site': 'same-site' },
    ]) {
      const response = await fetch(`${base}/${chart}${extension}?party1_size=3`, { headers });
      assert.equal(response.status, 403, `${chart}${extension}: ${JSON.stringify(headers)}`);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.match(response.headers.get('vary'), /Referer/);
      assert.equal((await response.json()).error, 'Hotlinking is disabled');
    }
  }
  for (const headers of [{}, { Referer: `${base}/page` }, { Origin: base }, { 'Sec-Fetch-Site': 'none' }, { 'Sec-Fetch-Site': 'same-origin' }]) {
    const response = await fetch(`${base}/arch.svg?party1_size=3`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  const head = await fetch(`${base}/arch.svg?party1_size=3`, { method: 'HEAD', headers: { Referer: 'https://external.example' } });
  assert.equal(head.status, 403);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(`${base}/health`)).status, 200);
});

test('PUBLIC_ORIGIN supports same-origin use behind an HTTPS reverse proxy', async t => {
  const base = await serve(t, { allowHotlinking: false, publicOrigin: 'https://charts.example.com' });
  const response = await fetch(`${base}/arch.svg?party1_size=3`, { headers: { Referer: 'https://charts.example.com/page', Origin: 'https://charts.example.com' } });
  assert.equal(response.status, 200);
  const foreignPort = await fetch(`${base}/arch.svg?party1_size=3`, { headers: { Referer: 'https://charts.example.com:8443/page' } });
  assert.equal(foreignPort.status, 403);
  const spoofed = await fetch(`${base}/arch.svg?party1_size=3`, { headers: { Referer: 'https://external.example/page', 'X-Forwarded-Host': 'external.example', 'X-Forwarded-Proto': 'https' } });
  assert.equal(spoofed.status, 403);
});
