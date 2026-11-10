import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parseInput, InputError } from './input.js';
import { renderArch } from './arch.js';
import { renderWestminster } from './westminster.js';
const apiInfo = {
  name: 'Parliament SVG API',
  endpoints: ['/arch.svg', '/us.svg', '/westminster.svg'],
  examples: {
    arch: '/arch.svg?party1_color=aaa&party1_size=324&party2_color=ee3344&party2_size=200',
    us: '/us.svg?democrats=48&republicans=50&independents=2',
    westminster: '/westminster.svg?party1_size=200&party1_color=0087dc&party1_group=left&party2_size=150&party2_color=dc241f&party2_group=right'
  },
  documentation: 'See README.md for all parameters. Encode # as %23 or omit it from hex colors.',
  attribution: 'Code translated into Node.js from Python code in https://github.com/slashme/parliamentdiagram and its parliamentarch dependency. BSD-3-Clause.'
};
export function readConfig(args = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({ args, options: { hotlinking: { type: 'boolean' }, 'no-hotlinking': { type: 'boolean' } } });
  if (values.hotlinking && values['no-hotlinking']) throw new Error('Use either --hotlinking or --no-hotlinking');
  if (env.ALLOW_HOTLINKING !== undefined && !['true', 'false'].includes(env.ALLOW_HOTLINKING)) throw new Error('ALLOW_HOTLINKING must be true or false');
  let publicOrigin;
  if (env.PUBLIC_ORIGIN) {
    const url = new URL(env.PUBLIC_ORIGIN);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin, e.g. https://charts.example.com');
    publicOrigin = url.origin;
  }
  return { allowHotlinking: values.hotlinking ? true : values['no-hotlinking'] ? false : env.ALLOW_HOTLINKING !== 'false', publicOrigin };
}
function isHotlink(req, publicOrigin) {
  const ownOrigin = publicOrigin ?? new URL(`${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`).origin;
  for (const header of ['origin', 'referer']) {
    if (req.headers[header]) {
      try {
        if (new URL(req.headers[header]).origin !== ownOrigin) return true;
      } catch { return true; }
    }
  }
  return ['cross-site', 'same-site'].includes(req.headers['sec-fetch-site']);
}
export function createApp({ allowHotlinking = true, publicOrigin } = {}) {
  return createServer({ maxHeaderSize: 32768 }, (req, res) => {
    if (allowHotlinking) res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', allowHotlinking ? 'cross-origin' : 'same-origin');
    if (!allowHotlinking) {
      res.setHeader('Vary', 'Origin, Referer, Sec-Fetch-Site');
      res.setHeader('Cache-Control', 'private, no-store');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data, null, 2) + '\n');
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { Allow: 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' });
      return res.end();
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD, OPTIONS');
      return sendJson(405, { error: 'Use GET or HEAD' });
    }
    try {
      if ((req.url?.length ?? 0) > 16384) return sendJson(414, { error: 'URL exceeds 16384 characters' });
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/') return sendJson(200, apiInfo);
      if (url.pathname === '/health') return sendJson(200, { status: 'ok' });
      const chart = url.pathname.slice(1).replace(/\.svg$/, '');
      if (!['arch', 'us', 'westminster'].includes(chart)) return sendJson(404, { error: 'Unknown endpoint', endpoints: apiInfo.endpoints });
      if (!allowHotlinking && isHotlink(req, publicOrigin)) return sendJson(403, { error: 'Hotlinking is disabled' });
      const { parties, options } = parseInput(url.searchParams, chart);
      const svg = chart === 'westminster' ? renderWestminster(parties, options) : renderArch(parties, options);
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(svg), 'Cache-Control': allowHotlinking ? 'public, max-age=3600' : 'private, no-store' });
      res.end(req.method === 'HEAD' ? undefined : svg);
    } catch (error) {
      if (error instanceof InputError) return sendJson(400, { error: error.message });
      console.error(error);
      sendJson(500, { error: 'Could not generate diagram' });
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
  const host = process.env.HOST ?? '0.0.0.0';
  const config = readConfig();
  const server = createApp(config);
  server.listen(port, host, () => console.log(`Parliament SVG API listening on http://${host}:${server.address().port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
