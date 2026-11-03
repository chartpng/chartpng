export interface ChartOptions {
  /** Pixels, 50-2000. Default 600. */
  width?: number;
  /** Pixels, 50-2000. Default 360. */
  height?: number;
  /** Any CSS color. Default white. */
  background?: string;
  /** 2 for retina screens. Default 1. */
  dpr?: 1 | 2;
  /** Named theme: default, editorial, mono, colorblind, vivid or ocean. The config's own theme wins. */
  theme?: string;
  /** Brand colours for the series, as hex: ['#1f5fad', '#e0712c'] or '1f5fad,e0712c'. 1 to 12. */
  palette?: string | string[];
  /** Report preset (kpi, ranking, comparison) and/or output preset (email, slack): 'ranking,email'. */
  preset?: string | string[];
  /** Paid API key. Never sent in URLs: chartUrl signs with it instead. */
  apiKey?: string;
  /** Default https://chartpng.dev */
  baseUrl?: string;
}

/** A Chart.js configuration object (plain JSON: no functions). */
export type ChartConfig = { type: string; data: unknown; options?: unknown } | string;

export const DEFAULT_BASE_URL: string;
export const MAX_URL_LENGTH: number;
export function chartUrl(config: ChartConfig, options?: ChartOptions): string;
export function renderChart(config: ChartConfig, options?: ChartOptions): Promise<Uint8Array>;
