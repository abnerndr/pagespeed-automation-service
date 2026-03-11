import express, { Request, Response } from 'express';
import { getBestPageSpeedResult } from './pagespeed';
import { PORT } from './constants/port';

const app = express();

/** Número padrão de execuções (editável via query param ou env) */
const DEFAULT_RUNS = 10;
const MAX_RUNS = 50;
const MIN_RUNS = 1;

function parseRuns(value: unknown): number {
  if (value == null) return DEFAULT_RUNS;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return DEFAULT_RUNS;
  return Math.max(MIN_RUNS, Math.min(MAX_RUNS, n));
}

app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'pagespeed-automation-service' });
});

/**
 * GET /analyze?url=<URL>&runs=<número>
 * ou
 * POST /analyze
 * Body: { "url": "https://...", "runs": 10 }
 *
 * Retorna a URL do relatório do PageSpeed com a melhor métrica (performance)
 * após executar várias análises (runs editável, padrão 10).
 */
app.get('/analyze', async (req: Request, res: Response) => {
  const url = req.query.url as string | undefined;
  const runs = parseRuns(req.query.runs ?? process.env.PAGESPEED_RUNS ?? DEFAULT_RUNS);

  if (!url?.trim()) {
    res.status(400).json({
      error: 'Parâmetro "url" é obrigatório',
      example: '/analyze?url=https://example.com&runs=10',
    });
    return;
  }

  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const result = await getBestPageSpeedResult(targetUrl, runs);
    res.json({
      urlAnalyzed: targetUrl,
      bestReportUrl: result.bestReportUrl,
      bestPerformanceScore: result.bestPerformanceScore,
      score: result.score,
      totalRuns: result.totalRuns,
      runs: result.runs.map(r => ({
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
});

app.post('/analyze', async (req: Request, res: Response) => {
  const body = req.body as { url?: string; runs?: number };
  const url = body?.url ?? (req.query.url as string | undefined);
  const runs = parseRuns(body?.runs ?? req.query.runs ?? process.env.PAGESPEED_RUNS ?? DEFAULT_RUNS);

  if (!url?.trim()) {
    res.status(400).json({
      error: 'Campo "url" é obrigatório',
      example: { url: 'https://example.com', runs: 10 },
    });
    return;
  }

  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const result = await getBestPageSpeedResult(targetUrl, runs);
    res.json({
      urlAnalyzed: targetUrl,
      bestReportUrl: result.bestReportUrl,
      bestPerformanceScore: result.bestPerformanceScore,
      score: result.score,
      totalRuns: result.totalRuns,
      runs: result.runs.map(r => ({
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
});

app.listen(PORT, () => {
  console.log(`PageSpeed Automation Service rodando em http://localhost:${PORT}`);
  console.log(`Exemplo: GET http://localhost:${PORT}/analyze?url=https://example.com&runs=10`);
});
