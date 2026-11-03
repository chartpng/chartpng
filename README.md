# ChartPNG

Chart.js configs in, PNG images out, by URL. Put charts where JavaScript can't run: emails, PDFs, Slack, Notion, Markdown and AI agent replies.

```
https://chartpng.dev/chart?c={"type":"bar","data":{"labels":["Mon","Tue","Wed"],"datasets":[{"label":"Signups","data":[12,19,7]}]}}
```

This repository holds the open parts of [ChartPNG](https://chartpng.dev): the JavaScript client, the MCP server and the n8n workflow templates. The rendering API runs at chartpng.dev and is not in this repository. Free images carry a small watermark; Pro removes it ([pricing](https://chartpng.dev/#pricing)).

## Packages

| Package | Folder | What it does |
|---|---|---|
| [`@chartpng/client`](https://www.npmjs.com/package/@chartpng/client) | [`packages/chartpng`](packages/chartpng) | Builds signed chart URLs and fetches PNGs. No dependencies. |
| [`@chartpng/mcp`](https://www.npmjs.com/package/@chartpng/mcp) | [`packages/chartpng-mcp`](packages/chartpng-mcp) | MCP server: AI agents draw charts with `chart_url` and `render_chart`. |

```bash
npm install @chartpng/client
```

```bash
claude mcp add chartpng -- npx -y @chartpng/mcp
```

Each package's README has the options and the setup for other MCP clients.

## n8n templates

Import any of these in n8n with **Import from URL**, using the link in the second column.

| Template | Import URL |
|---|---|
| Daily chart in an email | `https://chartpng.dev/templates/n8n/daily-chart-in-email.json` |
| Google Sheets chart to Telegram | `https://chartpng.dev/templates/n8n/google-sheets-chart-to-telegram.json` |
| Postgres query to a chart in an email | `https://chartpng.dev/templates/n8n/postgres-chart-to-email.json` |
| Google Sheets rows to a chart URL | `https://chartpng.dev/templates/n8n/sheets-rows-to-chart-url.json` |
| Weekly Stripe revenue to Slack | `https://chartpng.dev/templates/n8n/stripe-weekly-mrr-to-slack.json` |
| Weekly chart to Slack | `https://chartpng.dev/templates/n8n/weekly-chart-to-slack.json` |
| Weekly KPI report to Slack | `https://chartpng.dev/templates/n8n/weekly-kpi-report-to-slack.json` |

Guides for each one: https://chartpng.dev/guides/n8n

## Docs

- API reference: https://chartpng.dev/docs (also as Markdown: https://chartpng.dev/docs.md)
- OpenAPI: https://chartpng.dev/openapi.json
- Changelog: https://chartpng.dev/changelog

Questions and bugs: open an issue here or write to hola@chartpng.dev.

## License

MIT
