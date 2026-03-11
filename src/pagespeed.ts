import { chromium, type Browser } from 'playwright';

const PAGE_SPEED_URL = 'https://pagespeed.web.dev/';

/** Lança o Chromium; usa Chrome/Chromium do sistema se o bundle falhar (ex.: libnspr4.so ausente). */
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
const ANALYSIS_TIMEOUT_MS = 120_000; // 2 min por análise
const DEFAULT_RUNS = 10;

export interface RunResult {
  reportUrl: string;
  performanceScore: number | null;
  /** Score do medidor principal de Desempenho (número grande no relatório). */
  score: number | null;
  runIndex: number;
}

export interface BestResult {
  bestReportUrl: string;
  bestPerformanceScore: number | null;
  /** Melhor score do medidor principal de Desempenho. */
  score: number | null;
  totalRuns: number;
  runs: RunResult[];
}

/**
 * Executa uma única análise no pagespeed.web.dev e retorna a URL do relatório e o score (se encontrado).
 */
async function runSingleAnalysis(
  browser: Browser,
  urlToAnalyze: string,
  runIndex: number
): Promise<RunResult> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await page.goto(PAGE_SPEED_URL, { waitUntil: 'networkidle', timeout: 30_000 });

    // Fechar cookie consent se aparecer
    const cookieBtn = page.getByRole('button', { name: /ok|got it|aceitar|concordo/i });
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click();
      await page.waitForTimeout(500);
    }

    // Campo de URL: input ou textbox
    const urlInput = page.locator('input[type="url"], input[placeholder*="url" i], input[name="url"]').first();
    await urlInput.waitFor({ state: 'visible', timeout: 10_000 });
    await urlInput.fill(urlToAnalyze);

    // Botão Analyze
    const analyzeBtn = page.getByRole('button', { name: /analyze|analisar/i }).or(
      page.locator('button:has-text("Analyze")')
    ).first();
    await analyzeBtn.click();

    // Aguardar redirecionamento para a página de resultado
    await page.waitForURL(/\/analysis\?/, { timeout: 15_000 });

    // A análise do Lighthouse pode levar 30–90s; aguardar o fim
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    // Esperar até o texto "Running analysis" sumir ou timeout (até 90s)
    await page.waitForSelector('text=Running analysis', { state: 'detached', timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const runResult: RunResult = {
      reportUrl: page.url(),
      performanceScore: null,
      score: null,
      runIndex,
    };

    // Prioridade 0: seletor estável do relatório (HTML do Lighthouse)
    // Ex.: <a href="#performance"> ... <div class="lh-gauge__percentage">23</div> <div class="lh-gauge__label">Desempenho</div>
    try {
      const perfScoreEl = page.locator('a[href="#performance"] .lh-gauge__percentage').first();
      const txt = await perfScoreEl.textContent({ timeout: 10_000 }).catch(() => null);
      const num = txt != null ? parseInt(txt.trim(), 10) : NaN;
      if (Number.isNaN(num) === false && num >= 0 && num <= 100) {
        runResult.score = num;
      }
    } catch {
      // ignora
    }

    // Prioridade 1: achar o score pelo rótulo "Desempenho/Performance" (sem depender de ids dinâmicos)
    if (runResult.score === null) {
      try {
        const found = await page.evaluate(() => {
          const labelRegex = /^(desempenho|performance)$/i;
          const isValid = (n: number) => Number.isNaN(n) === false && n >= 0 && n <= 100;

          // Encontra elementos cujo texto é exatamente "Desempenho" (ou "Performance")
          const all = Array.from(document.querySelectorAll<HTMLElement>('*'));
          const labels = all.filter(el => labelRegex.test((el.textContent ?? '').trim()));

          for (const labelEl of labels) {
            // Sobe até um link (na UI, o score + label ficam dentro de um <a>)
            const anchor = labelEl.closest('a') as HTMLElement | null;
            const scope = anchor ?? (labelEl.parentElement as HTMLElement | null) ?? labelEl;
            const scopeText = (scope.textContent ?? '').trim();

            // Pega o primeiro número 0-100 dentro do mesmo escopo do label
            const matches = scopeText.match(/\b\d{1,3}\b/g) ?? [];
            for (const m of matches) {
              const n = parseInt(m, 10);
              if (isValid(n)) return n;
            }
          }

          return null;
        }).catch(() => null);

        if (found != null) runResult.score = found;
      } catch {
        // ignora
      }
    }

    // Extrair o número do medidor principal de Desempenho (elementos uniq-* ou SVG text)
    try {
      // 1) Elementos com id começando com "uniq-" (textContent do nó ou de descendentes)
      const uniqElements = page.locator('[id^="uniq-"]');
      const count = await uniqElements.count();
      for (let i = 0; i < count; i++) {
        const el = uniqElements.nth(i);
        const text = await el.textContent().catch(() => null);
        const num = text != null ? parseInt(text.trim(), 10) : NaN;
        if (Number.isNaN(num) === false && num >= 0 && num <= 100) {
          runResult.score = num;
          break;
        }
      }
      // 2) Filho direto ou descendente com o número (ex.: SVG <text> dentro de [id^="uniq-"])
      if (runResult.score === null && count > 0) {
        for (let i = 0; i < count; i++) {
          const el = uniqElements.nth(i);
          const inner = await el.evaluate((node) => node.textContent ?? '').catch(() => '');
          const num = parseInt(inner.trim(), 10);
          if (Number.isNaN(num) === false && num >= 0 && num <= 100) {
            runResult.score = num;
            break;
          }
        }
      }
      // 3) XPath: //*[starts-with(@id,"uniq-")]//*[local-name()="text"] (SVG text com o número)
      if (runResult.score === null) {
        const svgTexts = page.locator('xpath=//*[starts-with(@id,"uniq-")]//*[local-name()="text"]');
        const n = await svgTexts.count();
        for (let i = 0; i < n; i++) {
          const t = await svgTexts.nth(i).textContent().catch(() => null);
          const num = t != null ? parseInt(t.trim(), 10) : NaN;
          if (Number.isNaN(num) === false && num >= 0 && num <= 100) {
            runResult.score = num;
            break;
          }
        }
      }
      // 4) XPath: qualquer nó com id uniq- que tenha filho /text (caminho do usuário)
      if (runResult.score === null) {
        const byXpath = page.locator('xpath=//*[starts-with(@id,"uniq-")]');
        const k = await byXpath.count();
        for (let i = 0; i < k; i++) {
          const el = byXpath.nth(i);
          const fullText = await el.evaluate((node) => {
            const textNode = node.querySelector('text') ?? node.querySelector('[id]');
            return (textNode?.textContent ?? node.textContent ?? '').trim();
          }).catch(() => '');
          const num = parseInt(fullText, 10);
          if (Number.isNaN(num) === false && num >= 0 && num <= 100) {
            runResult.score = num;
            break;
          }
        }
      }
      // 5) No contexto da página: pegar texto de todos [id^="uniq-"] (incl. filhos) e primeiro 0-100
      if (runResult.score === null) {
        const found = await page.evaluate(() => {
          const nodes = document.querySelectorAll('[id^="uniq-"]');
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const text = (node.textContent ?? '').trim();
            const num = parseInt(text, 10);
            if (!Number.isNaN(num) && num >= 0 && num <= 100) return num;
            const child = node.querySelector('text');
            if (child) {
              const t = (child.textContent ?? '').trim();
              const n = parseInt(t, 10);
              if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
            }
          }
          return null;
        }).catch(() => null);
        if (found != null) runResult.score = found;
      }
    } catch {
      // mantém score null
    }

    // Manter performanceScore alinhado ao score quando possível (compatibilidade)
    if (runResult.score != null && runResult.performanceScore == null) {
      runResult.performanceScore = runResult.score;
    }

    // Fallback antigo para performanceScore se score não foi encontrado
    if (runResult.performanceScore === null) {
      try {
        const scoreSelectors = [
          '[class*="performance"] [class*="score"]',
          '[class*="Performance"] + * [class*="score"]',
          'span[class*="score"]',
          '[data-score]',
          'text=/\\d+\\s*\\/\\s*100/',
        ];
        for (const sel of scoreSelectors) {
          const el = page.locator(sel).first();
          if (await el.isVisible().catch(() => false)) {
            const text = await el.textContent();
            const match = text?.match(/(\d+)\s*\/\s*100|(\d+)\s*%/);
            if (match) {
              runResult.performanceScore = parseInt(match[1] ?? match[2] ?? '0', 10);
              if (runResult.performanceScore! > 100) runResult.performanceScore = null;
              break;
            }
          }
        }
        if (runResult.performanceScore === null) {
          const bodyText = await page.locator('body').textContent();
          const scores = bodyText?.match(/\b(9[0-9]|[1-8][0-9]|[0-9])\b/g) ?? [];
          const numericScores = scores.map(s => parseInt(s, 10)).filter(n => n >= 0 && n <= 100);
          if (numericScores.length > 0) {
            runResult.performanceScore = Math.max(...numericScores);
          }
        }
      } catch {
        // mantém null
      }
    }

    return runResult;
  } finally {
    await context.close();
  }
}

/**
 * Executa N análises no PageSpeed Insights e retorna a URL do relatório com a melhor métrica (performance).
 */
export async function getBestPageSpeedResult(
  urlToAnalyze: string,
  runs: number = DEFAULT_RUNS
): Promise<BestResult> {
  const runsNum = Math.max(1, Math.min(50, runs)); // entre 1 e 50
  const browser = await launchBrowser();

  const results: RunResult[] = [];

  try {
    for (let i = 0; i < runsNum; i++) {
      const result = await runSingleAnalysis(browser, urlToAnalyze, i + 1);
      results.push(result);
      // Pequena pausa entre execuções para não sobrecarregar
      if (i < runsNum - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } finally {
    await browser.close();
  }

  // Melhor = maior score (medidor principal) ou performanceScore; se não tiver, usa o primeiro
  const scoreValue = (r: RunResult) => r.score ?? r.performanceScore ?? -1;
  const withScore = results.filter(r => scoreValue(r) >= 0);
  const best = withScore.length > 0
    ? withScore.reduce((a, b) => (scoreValue(a) >= scoreValue(b) ? a : b))
    : results[0];

  return {
    bestReportUrl: best.reportUrl,
    bestPerformanceScore: best.performanceScore,
    score: best.score ?? best.performanceScore,
    totalRuns: runsNum,
    runs: results,
  };
}
