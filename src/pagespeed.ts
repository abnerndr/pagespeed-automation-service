import { chromium, type Browser, type Page } from 'playwright';
import { buildViewerUrl, pickBestRun, type PsiAnalyzeOptions, type PsiBestResult } from './psi-api';
import { isReportPermalink, parseGaugePercentage, type FormFactor } from './score';

const ANALYSIS_TIMEOUT_MS = 90_000;
const POLL_MS = 400;

/**
 * Medidor visível de Performance (não o header sticky nem o relatório Desktop escondido).
 */
const VISIBLE_PERFORMANCE_GAUGE =
  '.lh-scores-header a[href="#performance"] .lh-gauge__percentage';

export type { PsiBestResult as BestResult, PsiRunResult as RunResult } from './psi-api';

async function launchBrowser(): Promise<Browser> {
  const useSystemChrome = process.env.USE_SYSTEM_CHROME === '1' || process.env.USE_SYSTEM_CHROME === 'true';
  const options = { headless: true };

  if (useSystemChrome) {
    try {
      return await chromium.launch({ ...options, channel: 'chrome' });
    } catch {
      return await chromium.launch({ ...options, channel: 'chromium' });
    }
  }

  try {
    return await chromium.launch(options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/closed|libnspr4|libnss3|shared object|cannot open shared object/i.test(msg)) {
      try {
        return await chromium.launch({ ...options, channel: 'chrome' });
      } catch {
        return await chromium.launch({ ...options, channel: 'chromium' });
      }
    }
    throw err;
  }
}

async function waitForStoredReport(
  page: Page
): Promise<{ reportUrl: string; score: number | null }> {
  const gauge = page.locator(VISIBLE_PERFORMANCE_GAUGE).first();
  const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const reportUrl = page.url();
    let score: number | null = null;
    if (await gauge.isVisible().catch(() => false)) {
      score = parseGaugePercentage(await gauge.textContent());
    }
    if (isReportPermalink(reportUrl) && score != null) {
      return { reportUrl, score };
    }
    await page.waitForTimeout(POLL_MS);
  }

  const reportUrl = page.url();
  const score = await gauge.isVisible().catch(() => false)
    ? parseGaugePercentage(await gauge.textContent())
    : null;

  if (score == null) {
    throw new Error('Não foi possível ler o medidor de Performance no PageSpeed Insights');
  }

  return { reportUrl, score };
}

async function runBrowserAnalysis(
  browser: Browser,
  urlToAnalyze: string,
  strategy: FormFactor,
  runIndex: number
): Promise<PsiBestResult['runs'][number]> {
  const context = await browser.newContext({
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await page.goto(buildViewerUrl(urlToAnalyze, strategy), {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    const cookieBtn = page.getByRole('button', { name: /ok|got it|aceitar|concordo/i });
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click();
    }

    const { reportUrl, score } = await waitForStoredReport(page);
    return {
      runIndex,
      reportUrl,
      performanceScore: score,
      score,
    };
  } finally {
    await context.close();
  }
}

/**
 * Score e URL vêm do mesmo relatório salvo em pagespeed.web.dev
 * (`/analysis/{slug}/{id}?form_factor=...`). Abrir essa URL deve mostrar o mesmo medidor.
 *
 * A API oficial do Google não gera esse permalink — por isso não é usada no resultado
 * que você compara com o site (ela devolveria um score de um run e um link que dispara outro).
 */
export async function getBestPageSpeedResult(
  urlToAnalyze: string,
  runs: number = 3,
  options: PsiAnalyzeOptions = {}
): Promise<PsiBestResult> {
  const strategy = options.strategy ?? 'mobile';
  const runsNum = Math.max(1, Math.min(50, runs));
  const browser = await launchBrowser();
  const results: PsiBestResult['runs'] = [];

  try {
    for (let i = 0; i < runsNum; i++) {
      results.push(await runBrowserAnalysis(browser, urlToAnalyze, strategy, i + 1));
    }
  } finally {
    await browser.close();
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
