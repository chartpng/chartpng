// Client for ChartPNG: Chart.js configs as PNG images, by URL.
import { createHash, createHmac } from 'node:crypto';

export const DEFAULT_BASE_URL = 'https://chartpng.dev';

// Long GET URLs break in some email clients and proxies; past this, use renderChart.
export const MAX_URL_LENGTH = 8000;

// The largest image the API makes (2000 x 2000 at dpr 2) is well under this.
const MAX_PNG_BYTES = 10 * 1024 * 1024;

const SIGNED_FIELDS = ['c', 'w', 'h', 'bkg', 'dpr'];
// Signed only when the URL carries one, so a URL without them signs as it always did.
const STYLE_FIELDS = ['theme', 'palette', 'preset'];

function fieldsFor(config, { width, height, background, dpr, theme, palette, preset } = {}) {
  const fields = { c: typeof config === 'string' ? config : JSON.stringify(config) };
  if (width != null) fields.w = String(width);
  if (height != null) fields.h = String(height);
  if (background != null) fields.bkg = String(background);
  if (dpr != null) fields.dpr = String(dpr);
  if (theme != null) fields.theme = String(theme);
  if (palette != null) fields.palette = Array.isArray(palette) ? palette.join(',') : String(palette);
  if (preset != null) fields.preset = Array.isArray(preset) ? preset.join(',') : String(preset);
  return fields;
}

function keyId(secret) {
  return createHash('sha256').update(secret).digest('hex').slice(0, 12);
}

// Must match the server: a JSON array of the raw URL values.
function sign(secret, fields) {
  const names = STYLE_FIELDS.some((name) => fields[name] != null) ? [...SIGNED_FIELDS, ...STYLE_FIELDS] : SIGNED_FIELDS;
  const canonical = JSON.stringify(names.map((name) => fields[name] ?? null));
  return createHmac('sha256', secret).update(canonical).digest('hex').slice(0, 32);
}

/**
 * Builds an image URL you can put in an <img>, an email or Markdown.
 * With `apiKey`, the URL is signed: it proves the key without containing it.
 */
export function chartUrl(config, options = {}) {
  const fields = fieldsFor(config, options);
  if (options.apiKey) {
    fields.k = keyId(options.apiKey);
    fields.s = sign(options.apiKey, fields);
  }
  const url = new URL('/chart', options.baseUrl ?? DEFAULT_BASE_URL);
  for (const [name, value] of Object.entries(fields)) url.searchParams.set(name, value);
  return url.toString();
}

// The key travels in a header on renderChart, so only over https (or to a local dev server).
function apiUrl(baseUrl) {
  const url = new URL('/chart', baseUrl);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) throw new Error(`ChartPNG: baseUrl must use https, got ${url.origin}`);
  return url;
}

/** Renders the chart on the server and returns the PNG bytes. */
export async function renderChart(config, options = {}) {
  const { apiKey, baseUrl = DEFAULT_BASE_URL, width, height, background, dpr, theme, palette, preset } = options;
  const res = await fetch(apiUrl(baseUrl), {
    method: 'POST',
    // A redirect could carry the key elsewhere; a hung server should not hang the caller.
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ c: config, w: width, h: height, bkg: background, dpr, theme, palette, preset }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = String(body.error ?? res.statusText).replace(/[^\x20-\x7e]/g, '').slice(0, 200);
    throw new Error(`ChartPNG ${res.status}: ${reason}`);
  }
  if (res.headers.get('content-type') !== 'image/png') throw new Error('ChartPNG: the server did not return a PNG');
  const png = new Uint8Array(await res.arrayBuffer());
  if (png.byteLength > MAX_PNG_BYTES) throw new Error('ChartPNG: the image is larger than expected');
  return png;
}
