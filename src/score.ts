export type FormFactor = 'mobile' | 'desktop';

export interface ScoredPsiResult {
  formFactor: FormFactor | null;
  score: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function lighthouseResult(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload) || !isRecord(payload.lighthouseResult)) return null;
  return payload.lighthouseResult;
}

/** Inteiro 0–100 do medidor de Performance, igual à UI do PageSpeed. */
export function extractPerformanceScore(payload: unknown): number | null {
  const lh = lighthouseResult(payload);
  if (!lh || !isRecord(lh.categories) || !isRecord(lh.categories.performance)) return null;
  const score = lh.categories.performance.score;
  if (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 1) return null;
  return Math.round(score * 100);
}

export function formFactorFromPsiResponse(payload: unknown): FormFactor | null {
  const lh = lighthouseResult(payload);
  if (!lh || !isRecord(lh.configSettings)) return null;
  const formFactor = lh.configSettings.formFactor ?? lh.configSettings.emulatedFormFactor;
  if (formFactor === 'mobile' || formFactor === 'desktop') return formFactor;
  return null;
}

export function formFactorFromReportUrl(url: string): FormFactor {
  try {
    const formFactor = new URL(url).searchParams.get('form_factor');
    if (formFactor === 'desktop' || formFactor === 'mobile') return formFactor;
  } catch {
    // URL inválida: mantém o padrão da UI
  }
  return 'mobile';
}

export function selectScoreForReport(
  results: ScoredPsiResult[],
  reportFormFactor: FormFactor
): number | null {
  const match = results.find((r) => r.formFactor === reportFormFactor);
  if (match) return match.score;
  const unknown = results.filter((r) => r.formFactor == null);
  if (unknown.length === 1) return unknown[0].score;
  return null;
}

export function scoredResultFromPsiResponse(payload: unknown): ScoredPsiResult | null {
  const score = extractPerformanceScore(payload);
  if (score == null) return null;
  return { formFactor: formFactorFromPsiResponse(payload), score };
}

export function isPsiApiUrl(url: string): boolean {
  return /pagespeedonline|runPagespeed/i.test(url);
}

export function isReportPermalink(url: string): boolean {
  try {
    return /\/analysis\/[^/]+\/[^/?#]+/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function parseGaugePercentage(text: string | null): number | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  if (n < 0 || n > 100) return null;
  return n;
}
