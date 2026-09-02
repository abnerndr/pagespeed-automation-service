import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPsiApiUrl, buildViewerUrl, pickBestRun } from './psi-api';

describe('buildPsiApiUrl', () => {
  it('usa strategy=mobile por padrão, igual à aba padrão da UI', () => {
    const apiUrl = buildPsiApiUrl({ url: 'https://example.com' });
    const parsed = new URL(apiUrl);
    assert.equal(parsed.origin + parsed.pathname, 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    assert.equal(parsed.searchParams.get('url'), 'https://example.com');
    assert.equal(parsed.searchParams.get('strategy'), 'mobile');
    assert.equal(parsed.searchParams.getAll('category').includes('performance'), true);
  });

  it('inclui a API key quando fornecida', () => {
    const apiUrl = buildPsiApiUrl({ url: 'https://example.com', apiKey: 'abc123' });
    assert.equal(new URL(apiUrl).searchParams.get('key'), 'abc123');
  });
});

describe('buildViewerUrl', () => {
  it('abre o PageSpeed no mesmo form_factor da análise', () => {
    assert.equal(
      buildViewerUrl('https://example.com', 'mobile'),
      'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fexample.com&form_factor=mobile'
    );
  });
});

describe('pickBestRun', () => {
  it('escolhe o run com maior score de performance', () => {
    const runs = [
      { runIndex: 1, reportUrl: 'a', score: 40, performanceScore: 40 },
      { runIndex: 2, reportUrl: 'b', score: 71, performanceScore: 71 },
      { runIndex: 3, reportUrl: 'c', score: 55, performanceScore: 55 },
    ];
    const best = pickBestRun(runs);
    assert.equal(best.runIndex, 2);
    assert.equal(best.score, 71);
  });
});

describe('getBestPageSpeedResult', () => {
  it('converte o JSON da API no inteiro do medidor e escolhe o melhor run', async () => {
    const { getBestPageSpeedResult } = await import('./psi-api');
    const scores = [0.4, 0.71, 0.55];
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      const score = scores[calls] ?? 0;
      calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          lighthouseResult: {
            configSettings: { formFactor: 'mobile' },
            categories: { performance: { score } },
          },
        }),
        text: async () => '',
      } as Response;
    };

    const result = await getBestPageSpeedResult('https://example.com', 3, {
      fetchImpl,
      strategy: 'mobile',
    });

    assert.equal(result.score, 71);
    assert.equal(result.strategy, 'mobile');
    assert.equal(result.totalRuns, 3);
    assert.match(result.bestReportUrl, /form_factor=mobile/);
  });
});
