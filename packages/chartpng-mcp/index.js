#!/usr/bin/env node
// MCP server for ChartPNG: lets an agent turn data into a chart image it can
// show, attach or link in an email, a Slack message or a Markdown report.
//
// Written by hand over stdio (JSON-RPC 2.0, one message per line), with no
// dependencies besides @chartpng/client, which makes the HTTP calls.
// Spec: https://modelcontextprotocol.io/specification/2026-07-28 (read 3 Nov 2026).
// That revision dropped the `initialize` handshake: every request carries its
// protocol version in `_meta` and `server/discover` replaces the handshake. Most
// clients in use still open with `initialize` (2025-11-25 and earlier), so this
// server speaks both: a request whose `_meta` has a protocol version is served
// the modern way, and `initialize` is answered the legacy way.
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { chartUrl, renderChart, MAX_URL_LENGTH } from '@chartpng/client';

const { version: VERSION } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const SERVER_INFO = { name: 'chartpng', version: VERSION };

const MODERN_VERSION = '2026-07-28';
// Newest first. The first one is what `initialize` answers when it is asked for a version we do not speak.
const SUPPORTED_VERSIONS = [MODERN_VERSION, '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const LEGACY_LATEST = '2025-11-25';

const META_VERSION = 'io.modelcontextprotocol/protocolVersion';
const META_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities';
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

// JSON-RPC 2.0 codes, and the one MCP adds for a protocol version we do not speak.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;
const UNSUPPORTED_PROTOCOL_VERSION = -32022;

const settings = {
  apiKey: process.env.CHARTPNG_API_KEY || undefined,
  baseUrl: process.env.CHARTPNG_BASE_URL || undefined,
};

const CHART_TYPES = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble'];

const inputSchema = {
  type: 'object',
  properties: {
    config: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: CHART_TYPES },
        data: { type: 'object' },
        options: { type: 'object' },
      },
      required: ['type', 'data'],
      description:
        'A Chart.js v4 configuration as plain JSON (no functions), e.g. {"type":"bar","data":{"labels":[...],"datasets":[{"label":"...","data":[...]}]}}',
    },
    width: { description: 'Pixels, default 600', type: 'integer', minimum: 50, maximum: 2000 },
    height: { description: 'Pixels, default 360', type: 'integer', minimum: 50, maximum: 2000 },
    background: { description: 'CSS color, default white', type: 'string', maxLength: 32 },
  },
  required: ['config'],
};

const TOOLS = [
  {
    name: 'chart_url',
    title: 'Chart image URL',
    description:
      'Get a public PNG URL for a chart. Use it when the chart goes into an email, a Slack or chat message, a PDF or a Markdown document (as ![title](url)). The data travels in the URL: anyone with the URL can see the chart and its data, so for confidential data use render_chart.',
    inputSchema,
  },
  {
    name: 'render_chart',
    title: 'Render chart image',
    description: 'Render a chart and return the PNG image itself, to look at it or save it as a file. Takes configs up to 16 KB of JSON, larger than a URL allows.',
    inputSchema,
  },
];

// --- Arguments --------------------------------------------------------------

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const kind = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);

// What the tools did before: `config` keeps only type, data and options, in that
// order (the order is part of the URL that gets signed), and unknown keys are dropped.
function copyObject(source) {
  const copy = {};
  for (const [key, value] of Object.entries(source)) copy[key] = value;
  return copy;
}

function checkInteger(value, name) {
  if (value === undefined) return null;
  if (typeof value !== 'number') return `Invalid input: expected number, received ${kind(value)} at ${name}`;
  if (!Number.isSafeInteger(value)) return `Invalid input: expected int, received number at ${name}`;
  if (value < 50) return `Too small: expected number to be >=50 at ${name}`;
  if (value > 2000) return `Too big: expected number to be <=2000 at ${name}`;
  return null;
}

// Returns { value } or { error }, naming the first problem and where it is.
function parseArguments(args) {
  const { config, width, height, background } = args;
  if (!isObject(config)) return { error: `Invalid input: expected object, received ${kind(config)} at config` };
  if (!CHART_TYPES.includes(config.type)) {
    return { error: `Invalid option: expected one of ${CHART_TYPES.map((type) => `"${type}"`).join('|')} at config.type` };
  }
  if (!isObject(config.data)) return { error: `Invalid input: expected record, received ${kind(config.data)} at config.data` };
  if (config.options !== undefined && !isObject(config.options)) {
    return { error: `Invalid input: expected record, received ${kind(config.options)} at config.options` };
  }
  const widthError = checkInteger(width, 'width') ?? checkInteger(height, 'height');
  if (widthError) return { error: widthError };
  if (background !== undefined) {
    if (typeof background !== 'string') return { error: `Invalid input: expected string, received ${kind(background)} at background` };
    if (background.length > 32) return { error: 'Too big: expected string to have <=32 characters at background' };
  }
  const chart = { type: config.type, data: copyObject(config.data) };
  if (config.options !== undefined) chart.options = copyObject(config.options);
  return { value: { config: chart, width, height, background } };
}

// --- Tools ------------------------------------------------------------------

const text = (message, isError = false) => ({ content: [{ type: 'text', text: message }], ...(isError ? { isError: true } : {}) });

const handlers = {
  chart_url({ config, width, height, background }) {
    const url = chartUrl(config, { ...settings, width, height, background, dpr: 2 });
    if (url.length > MAX_URL_LENGTH) {
      return text(`The chart URL would be ${url.length} characters, too long for email clients. Reduce the data points or use render_chart to get the image itself.`, true);
    }
    return text(url);
  },
  async render_chart({ config, width, height, background }) {
    const png = await renderChart(config, { ...settings, width, height, background });
    return { content: [{ type: 'image', data: Buffer.from(png).toString('base64'), mimeType: 'image/png' }] };
  },
};

async function callTool(params) {
  if (typeof params.name !== 'string') throw rpcError(INVALID_PARAMS, 'Invalid params: name must be a string');
  if (params.arguments !== undefined && !isObject(params.arguments)) throw rpcError(INVALID_PARAMS, 'Invalid params: arguments must be an object');
  if (!Object.hasOwn(handlers, params.name)) throw rpcError(INVALID_PARAMS, `Unknown tool: ${params.name}`);
  // A bad argument is the agent's to fix, so it comes back as a tool result, not a protocol error.
  const parsed = parseArguments(params.arguments ?? {});
  if (parsed.error) return text(`Invalid arguments for tool ${params.name}: ${parsed.error}`, true);
  try {
    return await handlers[params.name](parsed.value);
  } catch (error) {
    return text(error instanceof Error ? error.message : String(error), true);
  }
}

// --- Protocol ---------------------------------------------------------------

function rpcError(code, message, data) {
  return Object.assign(new Error(message), { code, data });
}

function initialize(params) {
  if (typeof params.protocolVersion !== 'string') throw rpcError(INVALID_PARAMS, 'Invalid params: protocolVersion must be a string');
  // Legacy handshake: answer the requested version when we speak it, else our latest legacy one.
  const legacy = SUPPORTED_VERSIONS.filter((version) => version !== MODERN_VERSION);
  return {
    protocolVersion: legacy.includes(params.protocolVersion) ? params.protocolVersion : LEGACY_LATEST,
    capabilities: { tools: {} },
    serverInfo: SERVER_INFO,
  };
}

// Reads the per-request metadata of the modern protocol. Returns true when the
// request is a modern one (and checks it), false when it carries none (legacy).
function modernRequest(params) {
  const meta = params._meta;
  if (!isObject(meta) || !(META_VERSION in meta)) return false;
  const requested = meta[META_VERSION];
  if (!SUPPORTED_VERSIONS.includes(requested)) {
    throw rpcError(UNSUPPORTED_PROTOCOL_VERSION, 'Unsupported protocol version', { supported: SUPPORTED_VERSIONS, requested });
  }
  if (requested !== MODERN_VERSION) return false;
  if (!isObject(meta[META_CAPABILITIES])) throw rpcError(INVALID_PARAMS, `Invalid params: _meta["${META_CAPABILITIES}"] is required`);
  return true;
}

async function dispatch(method, params) {
  switch (method) {
    case 'initialize':
      return initialize(params);
    case 'ping':
      return {};
    case 'server/discover':
      if (!isObject(params._meta) || !(META_VERSION in params._meta)) {
        throw rpcError(INVALID_PARAMS, `Invalid params: _meta["${META_VERSION}"] is required`);
      }
      return { supportedVersions: SUPPORTED_VERSIONS, capabilities: { tools: {} }, ttlMs: 3600000, cacheScope: 'public' };
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call':
      return callTool(params);
    default:
      throw rpcError(METHOD_NOT_FOUND, 'Method not found');
  }
}

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const fail = (id, code, message, data) => send({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } });

async function handle(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return fail(null, PARSE_ERROR, 'Parse error');
  }
  if (Array.isArray(message)) return fail(null, INVALID_REQUEST, 'Invalid Request: batches are not supported');
  if (!isObject(message) || message.jsonrpc !== '2.0') return fail(null, INVALID_REQUEST, 'Invalid Request');
  // A response to something we never asked: nothing to do.
  if (!('method' in message) && ('result' in message || 'error' in message)) return;
  const hasId = 'id' in message;
  if (typeof message.method !== 'string') return fail(hasId && ['string', 'number'].includes(typeof message.id) ? message.id : null, INVALID_REQUEST, 'Invalid Request: method must be a string');
  // Notifications (notifications/initialized, notifications/cancelled, ...) get no answer.
  if (!hasId) return;
  if (typeof message.id !== 'string' && typeof message.id !== 'number') return fail(null, INVALID_REQUEST, 'Invalid Request: id must be a string or a number');
  const { id, method } = message;
  if (message.params !== undefined && !isObject(message.params)) return fail(id, INVALID_PARAMS, 'Invalid params: params must be an object');
  const params = message.params ?? {};
  try {
    const modern = modernRequest(params);
    const result = await dispatch(method, params);
    // Modern results say they are complete and name the server; legacy ones stay as they were.
    // A tool list never changes while the server runs, so the modern protocol may cache it for an hour.
    const cache = method === 'tools/list' ? { ttlMs: 3600000, cacheScope: 'public' } : {};
    send({ jsonrpc: '2.0', id, result: modern ? { resultType: 'complete', ...result, ...cache, _meta: { [META_SERVER_INFO]: SERVER_INFO } } : result });
  } catch (error) {
    if (typeof error?.code === 'number') fail(id, error.code, error.message, error.data);
    else fail(id, INTERNAL_ERROR, 'Internal error');
  }
}

// Lines are handled as they come, so a slow render does not hold up a ping.
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on('line', (line) => {
  if (line.trim() !== '') handle(line);
});
// The client is gone: nothing left to write to.
process.stdout.on('error', () => process.exit(0));
