# Parliament SVG API

A small Node.js HTTP server that generates parliament diagrams as SVGs. The code
was translated into Node.js from the Python code in
[slashme/parliamentdiagram](https://github.com/slashme/parliamentdiagram) and its
[parliamentarch](https://github.com/Gouvernathor/parliamentarch) dependency.
Licensed under BSD-3-Clause; see [LICENSE](LICENSE),
[NOTICE](NOTICE), and [the parliamentarch license](licenses/parliamentarch-LICENSE).

## Run

Requires Node.js 22 or newer. There are no runtime dependencies or install step.

```sh
npm start
```

The server listens on port 3000. Set `PORT` and `HOST` as needed:

```sh
HOST=127.0.0.1 PORT=8080 npm start
```

## Hotlinking

Hotlinking is enabled by default, so other websites can embed your SVG URLs.
Disable it with a server startup flag:

```sh
npm start -- --no-hotlinking
```

Or set an environment variable:

```sh
ALLOW_HOTLINKING=false npm start
```

Enable it explicitly with `npm start -- --hotlinking` or
`ALLOW_HOTLINKING=true npm start`. CLI flags override the environment variable.
This is a server setting, not a query parameter that visitors can override.
Restart the server after changing it.

When disabled, chart routes reject external `Origin`, `Referer`, and cross-origin
`Sec-Fetch-Site` headers with HTTP 403. Responses use
`Cross-Origin-Resource-Policy: same-origin`, omit wildcard CORS, and disable
caching. Your own origin can still embed the charts. Direct address-bar visits
and clients such as curl without source headers continue to work.

Behind a reverse proxy, configure the public origin explicitly:

```sh
PUBLIC_ORIGIN=https://charts.example.com npm start -- --no-hotlinking
```

Origins match by scheme, hostname, and port. Forwarded headers are not trusted.
This is browser hotlink protection, not authentication: clients can forge or omit
source headers. Purge any existing proxy/CDN cache when changing the setting and
configure the proxy to respect the response cache headers.

## Request an SVG

Each `.svg` endpoint generates and returns the actual SVG document with
`Content-Type: image/svg+xml`. There are no saved image files, redirects, or JSON
wrappers for successful diagram requests. Use the URL directly in a browser,
`<img>` tag, or download it:

```text
http://localhost:3000/arch.svg?party1_color=aaa&party1_size=324&party2_color=dd3344&party2_size=200
```

```sh
curl 'http://localhost:3000/arch.svg?party1_color=aaa&party1_size=324' -o parliament.svg
```

```html
<img src="http://localhost:3000/arch.svg?party1_color=aaa&amp;party1_size=324" alt="Parliament with 324 seats">
```

**Omit `#` from hex colors or encode it as `%23`.** A literal `#` starts a URL
fragment, which browsers do not send to the server. For example,
`party1_color=%23aaa&party1_size=324` works; `party1_color=#aaa` does not.
Use `URLSearchParams` to encode names and colors when building URLs in code.

| Endpoint | Diagram |
| --- | --- |
| `/arch.svg` | Semicircular parliament with parties from left to right |
| `/us.svg` | Same arch geometry, with optional US party presets |
| `/westminster.svg` | Opposing benches, cross-bench, and Speaker seats |

The extensionless `/arch`, `/us`, and `/westminster` routes are aliases.
`GET /` returns API information and examples; `GET /health` returns a health check.
Diagram routes support `GET` and `HEAD`; `OPTIONS` supports cross-origin use.

## Parties

All three endpoints accept numbered parties. Numbering starts at 1; gaps are
allowed. Parties are ordered numerically (`party2` before `party10`).

| Query parameter | Default | Meaning |
| --- | --- | --- |
| `party1_size` | Required | Integer seat count, including zero |
| `party1_color` | `aaa` | Hex color: 3, 4, 6, or 8 digits, with optional encoded `#` |
| `party1_name` | `Party 1` | Name in the SVG group title; at most 200 characters |
| `party1_group` | Odd-numbered parties: `left`; even: `right` | Westminster only: `left`, `right`, `center`, `head` |
| `party1_border_size` | `0` | Arch/US only: border width as a fraction of seat radius, 0–1 |
| `party1_border_color` | `000` | Arch/US only: hex border color |

Repeat with `party2_…`, `party3_…`, etc. The maximum is 100 parties, with a total
of 1–10,000 seats. Zero-seat parties are omitted. SVG backgrounds are transparent.

### Arch and US options

| Parameter | Default | Accepted values |
| --- | --- | --- |
| `min_nrows` | `0` (automatic) | Integer 0–100; minimum number of rows |
| `span_angle` | `180` | 10–180 degrees |
| `seat_radius_factor` | `0.8` | 0.01–1; seat size relative to available spacing |
| `filling_strategy` | `default` | `default`, `empty_inner`, `outer_priority` |
| `denser_rows` | `false` | `true` selects `empty_inner`; use instead of `filling_strategy` |
| `canvas_size` | `175` | 10–2,000; diagram height before margins, half its width |
| `margins` | `5` | 0–200; margin on every side |
| `write_number_of_seats` | `true` | Whether to display the total seat count |
| `font_size_factor` | `36/175` | 0.01–1; font size relative to `canvas_size` |

`default` distributes seats proportionally across all rows. `empty_inner` uses
as few outer rows as possible, then distributes seats proportionally.
`outer_priority` fills outer rows before using an inner row.

### US presets

The original repository's US chart uses the same geometry as its arch chart.
For convenience, `/us.svg` also accepts `democrats`, `republicans`, `independents`,
and `vacant` seat counts, with blue, red, light gray, and dark gray colors.
Unspecified preset counts are zero. Use presets or numbered parties in one request.

```text
http://localhost:3000/us.svg?democrats=48&republicans=50&independents=2
```

### Westminster options

The `left` group occupies the upper bench, `right` the lower bench, `center`
the cross-bench on the right, and `head` the Speaker positions on the left.

| Parameter | Default | Accepted values |
| --- | --- | --- |
| `wingrows` | Automatic | Integer 1–100; initial bench row count |
| `centercols` | Automatic | Integer 1–100; cross-bench column count |
| `cozy` | `false` | Pack parties together without reserved column gaps |
| `fullwidth` | `false` | Spread wings across the available length |
| `radius` | `0` | 0–0.5; rounded corner radius relative to seat size |
| `spacing` | `0.1` | 0–0.9; space between seats relative to grid cell size |

```text
http://localhost:3000/westminster.svg?party1_name=Government&party1_color=0087dc&party1_size=200&party1_group=left&party2_name=Opposition&party2_color=dc241f&party2_size=150&party2_group=right&party3_size=15&party3_group=center&party4_size=1&party4_group=head
```

Boolean parameters accept `true`, `false`, `1`, or `0`.

## Errors and limits

Invalid inputs return HTTP 400 with a JSON `error` message. Unknown and duplicate
query parameters are rejected. Unknown routes return 404; unsupported methods
return 405. URLs longer than 16,384 characters return 414, subject to the HTTP
server's header limit. Diagram requests are stateless and deterministic. With hotlinking enabled, responses
allow cross-origin embedding/fetching and carry a one-hour public cache header.

## Development and verification

```sh
npm test
npm run dev
```

Tests compare geometry against Python-generated fixtures for all three arch
filling strategies and all four Westminster cozy/fullwidth combinations. HTTP
tests check SVG responses, seat counts, validation, XML escaping, and edge cases.
Python is not required to run this project or its tests.

See NOTICE for source versions and intentional corrections to upstream behavior.
