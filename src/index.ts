import express, { Request, Response } from 'express';
import { getBestPageSpeedResult } from './pagespeed';
import { PORT } from './constants/port';
import type { FormFactor } from './score';
import { mountDocs } from './docs';

const app = express();

const DEFAULT_RUNS = 3;
const MAX_RUNS = 50;
const MIN_RUNS = 1;

function parseRuns(value: unknown): number {
  if (value == null) return DEFAULT_RUNS;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return DEFAULT_RUNS;
  return Math.max(MIN_RUNS, Math.min(MAX_RUNS, n));
}

function parseStrategy(value: unknown): FormFactor {
  return String(value ?? 'mobile').toLowerCase() === 'desktop' ? 'desktop' : 'mobile';
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function handleAnalyze(req: Request, res: Response, urlRaw: string | undefined, runsRaw: unknown, strategyRaw: unknown): Promise<void> {
  if (!urlRaw?.trim()) {
    res.status(400).json({
      error: 'Parâmetro "url" é obrigatório',
      example: '/analyze?url=https://example.com&runs=3&strategy=mobile',
    });
    return;
  }

  const targetUrl = normalizeUrl(urlRaw);
  const runs = parseRuns(runsRaw);
  const strategy = parseStrategy(strategyRaw);

  try {
    const result = await getBestPageSpeedResult(targetUrl, runs, { strategy });
    res.json({
      urlAnalyzed: targetUrl,
      strategy: result.strategy,
      bestReportUrl: result.bestReportUrl,
      bestPerformanceScore: result.bestPerformanceScore,
      score: result.score,
      totalRuns: result.totalRuns,
      runs: result.runs.map((r) => ({
        runIndex: r.runIndex,
        reportUrl: r.reportUrl,
        performanceScore: r.performanceScore,
        score: r.score,
      })),
    });
  } catch (err) {
    console.error('PageSpeed automation error:', err);
    res.status(500).json({
      error: 'Erro ao executar análises no PageSpeed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.redirect('/docs');
});

mountDocs(app);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'pagespeed-automation-service' });
});

app.get('/analyze', async (req: Request, res: Response) => {
  await handleAnalyze(
    req,
    res,
    req.query.url as string | undefined,
    req.query.runs ?? process.env.PAGESPEED_RUNS ?? DEFAULT_RUNS,
    req.query.strategy
  );
});

app.post('/analyze', async (req: Request, res: Response) => {
  const body = req.body as { url?: string; runs?: number; strategy?: string };
  await handleAnalyze(
    req,
    res,
    body?.url ?? (req.query.url as string | undefined),
    body?.runs ?? req.query.runs ?? process.env.PAGESPEED_RUNS ?? DEFAULT_RUNS,
    body?.strategy ?? req.query.strategy
  );
});

app.listen(PORT, () => {
  console.log(`PageSpeed Automation Service rodando em http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/docs`);
  console.log(`OpenAPI:    http://localhost:${PORT}/openapi.json`);
  console.log(`Exemplo: GET http://localhost:${PORT}/analyze?url=https://example.com&runs=3&strategy=mobile`);
});
