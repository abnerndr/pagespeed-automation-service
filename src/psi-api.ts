import { extractPerformanceScore, type FormFactor } from './score';

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const VIEWER_ORIGIN = 'https://pagespeed.web.dev/analysis';
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;
const DEFAULT_CONCURRENCY = 3;

export interface ScoredRun {
  score: number | null;
  performanceScore: number | null;
}

export interface PsiRunResult extends ScoredRun {
  reportUrl: string;
  runIndex: number;
}

export interface PsiBestResult {
  bestReportUrl: string;
  bestPerformanceScore: number | null;
  score: number | null;
  totalRuns: number;
  strategy: FormFactor;
  runs: PsiRunResult[];
}

export interface PsiAnalyzeOptions {
  strategy?: FormFactor;
  apiKey?: string;
  concurrency?: number;
  fetchImpl?: typeof fetch;
}

export function buildPsiApiUrl(params: {
  url: string;
  strategy?: FormFactor;
  apiKey?: string;
}): string {
  const apiUrl = new URL(PSI_ENDPOINT);
  apiUrl.searchParams.set('url', params.url);
  apiUrl.searchParams.set('strategy', params.strategy ?? 'mobile');
  apiUrl.searchParams.append('category', 'performance');
  if (params.apiKey) apiUrl.searchParams.set('key', params.apiKey);
  return apiUrl.toString();
}

export function buildViewerUrl(url: string, strategy: FormFactor): string {
  const viewer = new URL(VIEWER_ORIGIN);
  viewer.searchParams.set('url', url);
  viewer.searchParams.set('form_factor', strategy);
  return viewer.toString();
}

export function pickBestRun<T extends ScoredRun>(runs: T[]): T {
  return runs.reduce((best, current) => {
    const bestScore = best.score ?? best.performanceScore ?? -1;
    const currentScore = current.score ?? current.performanceScore ?? -1;
    return currentScore > bestScore ? current : best;
  });
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function fetchPsiPayload(
  targetUrl: string,
  strategy: FormFactor,
  apiKey: string | undefined,
  fetchImpl: typeof fetch,
  maxAttempts: number
): Promise<unknown> {
  const apiUrl = buildPsiApiUrl({ url: targetUrl, strategy, apiKey });
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetchImpl(apiUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`PageSpeed API HTTP ${response.status}`);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`PageSpeed API HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }

    return response.json();
  }

  throw lastError ?? new Error('PageSpeed API request failed');
}

export async function getBestPageSpeedResult(
  urlToAnalyze: string,
  runs: number = 3,
  options: PsiAnalyzeOptions = {}
): Promise<PsiBestResult> {
  const strategy = options.strategy ?? 'mobile';
  const apiKey = options.apiKey ?? process.env.PAGESPEED_API_KEY ?? process.env.PSI_API_KEY;
  const fetchImpl = options.fetchImpl ?? fetch;
  const runsNum = Math.max(1, Math.min(50, runs));
  const concurrency = Math.max(1, Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, runsNum));
  const maxAttempts = apiKey ? MAX_ATTEMPTS : 1;
  const reportUrl = buildViewerUrl(urlToAnalyze, strategy);

  const results = await mapPool(
    Array.from({ length: runsNum }, (_, i) => i + 1),
    concurrency,
    async (runIndex) => {
      try {
        const payload = await fetchPsiPayload(urlToAnalyze, strategy, apiKey, fetchImpl, maxAttempts);
        const score = extractPerformanceScore(payload);
        return {
          runIndex,
          reportUrl,
          score,
          performanceScore: score,
        };
      } catch {
        return {
          runIndex,
          reportUrl,
          score: null,
          performanceScore: null,
        };
      }
    }
  );

  if (results.every((run) => run.score == null && run.performanceScore == null)) {
    throw new Error('PageSpeed API não retornou score em nenhum run');
  }

  const best = pickBestRun(results);

  return {
    bestReportUrl: best.reportUrl,
    bestPerformanceScore: best.performanceScore,
    score: best.score ?? best.performanceScore,
    totalRuns: runsNum,
    strategy,
    runs: results,
  };
}
