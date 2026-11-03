# @chartpng/mcp

An MCP server that lets AI agents draw charts. The agent sends a Chart.js config and gets back either a PNG URL (for emails, Slack, PDFs and Markdown reports) or the image itself.

## Tools

- `chart_url`: returns a public PNG URL, signed with your key if you have one.
- `render_chart`: returns the PNG image.

## Agents

How an agent uses it:

1. Build a Chart.js v4 config as a JSON object: `type`, `data` and optionally `options`. No functions. `type` is one of `bar`, `line`, `pie`, `doughnut`, `radar`, `polarArea`, `scatter` or `bubble`.
2. Call `chart_url` when the chart goes into an email, a Slack message, a PDF or a Markdown report, and paste the URL as `![title](url)`. The data travels in the URL, so for confidential data call `render_chart` and keep the image.
3. Call `render_chart` to look at the chart or save it as a file. It takes configs up to 16 KB.
4. For a metrics report, add a preset under `options.plugins.chartpng` instead of styling the chart by hand.

Tool arguments are `config`, plus optional `width`, `height` (50 to 2000 pixels) and `background`.

### Presets

A preset sets the layout of a report chart. The look comes from the default theme, and anything your config sets wins.

| Preset | Config | What it draws |
|---|---|---|
| `kpi` | `line` or `bar`, one dataset | The last value as a big number, a change chip and a sparkline. `previous` sets the value to compare with, `prefix` and `suffix` go around the number. |
| `ranking` | `bar`; the first dataset sets the order | Horizontal bars from highest to lowest with the first one highlighted. Send the rows in any order. |
| `comparison` | `line` or `bar`, two datasets | The current period first, the previous one second in grey, with the percentage change above each current-period point. |
| `funnel` | `bar`, one dataset with a value per stage (up to 12, none negative) | Stages from top to bottom, each as wide as its value, with the value and the share of the previous stage beside it. `prefix` and `suffix` go around the values. |
| `gauge` | `doughnut`, one dataset whose first number is the value | A half ring filled up to `max` (default 100) with the value big in the middle. `prefix` and `suffix` go around the number. |

The renderer refuses an unknown preset name, and a chart of the wrong shape for its preset, with an error that says what is wrong. `render_chart` hands that error to the agent. `chart_url` builds the URL without drawing the chart, so the error shows when the URL is fetched.

A `kpi` for monthly recurring revenue, 9,840 against 9,100 last week:

```json
{
  "config": {
    "type": "line",
    "data": {
      "labels": ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
      "datasets": [{ "label": "MRR", "data": [8200, 8650, 8400, 8900, 9100, 9350, 9100, 9840] }]
    },
    "options": {
      "plugins": { "chartpng": { "preset": "kpi", "previous": 9100, "prefix": "$" } }
    }
  },
  "width": 800,
  "height": 400
}
```

A `ranking` of signups by channel:

```json
{
  "config": {
    "type": "bar",
    "data": {
      "labels": ["Newsletter", "Organic search", "Direct", "Referral", "Social"],
      "datasets": [{ "label": "Share of signups", "data": [27, 38, 12, 17, 6] }]
    },
    "options": {
      "plugins": { "chartpng": { "preset": "ranking", "suffix": "%" } }
    }
  },
  "width": 800,
  "height": 450
}
```

A `comparison` of this week against last week:

```json
{
  "config": {
    "type": "bar",
    "data": {
      "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      "datasets": [
        { "label": "This week", "data": [42, 55, 38, 61, 70, 33, 29] },
        { "label": "Last week", "data": [36, 48, 41, 52, 58, 35, 24] }
      ]
    },
    "options": {
      "plugins": { "chartpng": { "preset": "comparison" } }
    }
  },
  "width": 800,
  "height": 450
}
```

A `funnel` of signups, from visitors to paying customers:

```json
{
  "config": {
    "type": "bar",
    "data": {
      "labels": ["Visitors", "Signups", "Trials", "Paying"],
      "datasets": [{ "data": [12400, 3100, 930, 214] }]
    },
    "options": {
      "plugins": { "chartpng": { "preset": "funnel" } }
    }
  },
  "width": 800,
  "height": 450
}
```

A `gauge` of revenue against a $50,000 goal:

```json
{
  "config": {
    "type": "doughnut",
    "data": { "datasets": [{ "data": [37250] }] },
    "options": {
      "plugins": { "chartpng": { "preset": "gauge", "max": 50000, "prefix": "$" } }
    }
  },
  "width": 800,
  "height": 450
}
```

### Repaired configs and the `X-ChartPNG-Fixes` header

The ChartPNG API repairs the usual slips of near-JSON written by language models and lists what it changed in the `X-ChartPNG-Fixes` response header, as codes separated by commas. When nothing was repaired the header is absent.

| Code | What was repaired |
|---|---|
| `code_fence` | The config came wrapped in a Markdown code fence. |
| `trailing_comma` | A comma before a closing bracket or brace. |
| `single_quotes` | Strings in single quotes. |
| `unquoted_keys` | Object keys without quotes. |
| `double_encoded` | The config was JSON inside a JSON string. |
| `function_string` | A function written as text was removed. It is never run. |
| `missing_type` | No `type` but datasets present, so it was drawn as `bar`. This one is a guess: set `type` if you meant another chart. |
| `v2_scales` | A Chart.js v2 axis (`scales.xAxes` or `scales.yAxes`) became `scales.x`, `scales.y` or, with several axes that have ids, one entry per id, with `gridLines`, `scaleLabel`, the `ticks` limits and the `fontColor`, `fontSize`, `fontStyle` and `fontFamily` options moved to their v4 names. Only on bar, line, scatter and bubble charts. |
| `v2_plugins` | `options.legend`, `options.title` or `options.tooltips` moved under `options.plugins`, with their font options in the v4 form. |
| `v2_datasets` | The dataset option `steppedLine` became `stepped`. |
| `v2_defaults` | A v2 line chart whose datasets do not say `fill` gets `options.elements.line.fill: true`: Chart.js 2 filled the area under a line by default, Chart.js 4 does not. |

The two tools here take `config` as a structured object whose `type` is required, so the text slips (a fence, quotes, commas, double encoding, a missing type) cannot reach ChartPNG through them. Two kinds of repair still apply to a structured config, and the tools do not show response headers, so the agent is not told: a function written as text is removed, and Chart.js v2 options are translated. Send Chart.js v4 options and no functions. An agent that calls `GET` or `POST /chart` itself sees the header:

```bash
curl -s -o /dev/null -D - -G https://chartpng.dev/chart \
  --data-urlencode "c={data:{labels:['Mon','Tue'],datasets:[{data:[12,19],}]}}" \
  | grep -i '^x-chartpng-fixes'

# x-chartpng-fixes: trailing_comma,single_quotes,unquoted_keys,missing_type
```

A code in the header means the config was not strict Chart.js v4 JSON. Send the corrected form next time.

## Setup

Claude Code:

```bash
claude mcp add -s user -e CHARTPNG_API_KEY=your-key chartpng -- npx -y @chartpng/mcp@0.2.0
```

Claude Desktop, Cursor and other clients (`mcpServers` in their config file):

```json
{
  "mcpServers": {
    "chartpng": {
      "command": "npx",
      "args": ["-y", "@chartpng/mcp@0.2.0"],
      "env": { "CHARTPNG_API_KEY": "optional, removes the watermark" }
    }
  }
}
```

Keep the key in your user-level config, not in a project file such as `.mcp.json` that gets committed. Without a key it still works and images carry a small watermark. A [Pro key](https://chartpng.dev) removes it. The key never appears in the image URLs the agent shares.

| Variable | |
|---|---|
| `CHARTPNG_API_KEY` | Optional Pro key |
| `CHARTPNG_BASE_URL` | Default `https://chartpng.dev` |

## Protocol

The server is written by hand over stdio (JSON-RPC 2.0, one message per line) and installs nothing but [`@chartpng/client`](https://www.npmjs.com/package/@chartpng/client), which has no dependencies of its own. It speaks the [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) revision of MCP (`server/discover`, the version in each request's `_meta`) and the `initialize` handshake of 2025-11-25, 2025-06-18, 2025-03-26 and 2024-11-05. It also answers `ping`.

Arguments that break the schema (a missing `config`, a `width` of 40, a chart `type` that is not in the list) come back as a tool result with `isError: true` that names the field, so the agent can fix them. A malformed request, an unknown tool or an unknown method is a JSON-RPC error (`-32602` or `-32601`).

Full API reference: https://chartpng.dev/docs

MIT
