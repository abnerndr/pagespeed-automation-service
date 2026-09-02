import { chromium, type Browser, type Page } from 'playwright';
import { getBestPageSpeedResult as getBestFromPsiApi, buildViewerUrl, pickBestRun, type PsiAnalyzeOptions, type PsiBestResult } from './psi-api';
import { parseGaugePercentage, type FormFactor } from './score';

const ANALYSIS_TIMEOUT_MS = 90_000;
const GAUGE_TEXT_TIMEOUT_MS = 10_000;

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

async function readVisiblePerformanceScore(page: Page): Promise<number | null> {
  const gauge = page.locator(VISIBLE_PERFORMANCE_GAUGE).first();
  await gauge.waitFor({ state: 'visible', timeout: ANALYSIS_TIMEOUT_MS });

  const deadline = Date.now() + GAUGE_TEXT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const score = parseGaugePercentage(await gauge.textContent());
    if (score != null) return score;
    await page.waitForTimeout(200);
  }

  return parseGaugePercentage(await gauge.textContent());
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

    const score = await readVisiblePerformanceScore(page);
    return {
      runIndex,
      reportUrl: page.url(),
      performanceScore: score,
      score,
    };
  } finally {
    await context.close();
  }
}

async function getBestFromBrowser(
  urlToAnalyze: string,
  runs: number,
  strategy: FormFactor
): Promise<PsiBestResult> {
  const browser = await launchBrowser();
  const results: PsiBestResult['runs'] = [];

  try {
    for (let i = 0; i < runs; i++) {
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
    totalRuns: runs,
    strategy,
    runs: results,
  };
}

/**
 * Prefere a API oficial (rápida e com o mesmo inteiro da UI).
 * Sem chave ou com 429, cai no site — já na URL de análise, sem preencher o form.
 */
export async function getBestPageSpeedResult(
  urlToAnalyze: string,
  runs: number = 3,
  options: PsiAnalyzeOptions = {}
): Promise<PsiBestResult> {
  const strategy = options.strategy ?? 'mobile';
  const apiKey = options.apiKey ?? process.env.PAGESPEED_API_KEY ?? process.env.PSI_API_KEY;
  const runsNum = Math.max(1, Math.min(50, runs));

  try {
    return await getBestFromPsiApi(urlToAnalyze, runsNum, {
      ...options,
      strategy,
      apiKey,
      concurrency: apiKey ? options.concurrency : 1,
    });
  } catch (err) {
    if (options.fetchImpl) throw err;
    console.warn('PageSpeed API indisponível, usando o site:', err instanceof Error ? err.message : err);
    return getBestFromBrowser(urlToAnalyze, runsNum, strategy);
  }
}
