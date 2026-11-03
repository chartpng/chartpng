# @chartpng/client

Turn a Chart.js config into a PNG image URL. Use it where JavaScript charts can't run: emails, PDFs, Slack, Notion, Markdown and AI agent replies.

```bash
npm install @chartpng/client
```

```js
import { chartUrl, renderChart } from '@chartpng/client';

const config = {
  type: 'bar',
  data: { labels: ['Mon', 'Tue', 'Wed'], datasets: [{ label: 'Signups', data: [12, 19, 7] }] },
};

// An image URL for <img src>, an email or Markdown.
const url = chartUrl(config, { width: 600, height: 300, dpr: 2 });

// Or the PNG bytes, for attachments and files.
const png = await renderChart(config);
```

## Plans

Free images carry a small watermark. A [Pro key](https://chartpng.dev) removes it:

```js
const url = chartUrl(config, { apiKey: process.env.CHARTPNG_API_KEY });
```

The key never appears in the URL. `chartUrl` signs the chart with it, so anyone who sees the image URL (say, an email recipient) can't reuse your key for other charts. Keep the key on the server; don't ship it to browsers.

## Options

| Option | Default | |
|---|---|---|
| `width`, `height` | 600, 360 | 50-2000 px |
| `dpr` | 1 | `2` for retina screens |
| `background` | `white` | Any CSS color |
| `theme` | `default` | `editorial`, `mono`, `colorblind`, `vivid` or `ocean` |
| `palette` | the theme's | Brand colours, `['#1f5fad', '#e0712c']`, 1 to 12 |
| `preset` | none | `email` or `slack` (size, retina, opaque background), alone or with a report preset: `'ranking,email'` |
| `apiKey` | none | Pro key |
| `baseUrl` | `https://chartpng.dev` | |

Configs must be plain JSON (no functions). URLs longer than `MAX_URL_LENGTH` (8,000 characters) can break in some email clients; use `renderChart` for large datasets.

Full API reference: https://chartpng.dev/docs

MIT
