import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPerformanceScore,
  formFactorFromPsiResponse,
  formFactorFromReportUrl,
  isPsiApiUrl,
  isReportPermalink,
  parseGaugePercentage,
  selectScoreForReport,
} from './score';

function psiPayload(score: number, formFactor: 'mobile' | 'desktop') {
  return {
    lighthouseResult: {
      configSettings: { formFactor },
      categories: {
        performance: { score },
        accessibility: { score: 0.96 },
      },
    },
  };
}

describe('extractPerformanceScore', () => {
  it('converte o score 0–1 da API no inteiro do medidor (ex.: 0.35 → 35)', () => {
    assert.equal(extractPerformanceScore(psiPayload(0.35, 'mobile')), 35);
  });

  it('usa Math.round, igual à UI do PageSpeed (0.894 → 89)', () => {
    assert.equal(extractPerformanceScore(psiPayload(0.894, 'mobile')), 89);
  });

  it('mapeia 1 para 100 e 0 para 0', () => {
    assert.equal(extractPerformanceScore(psiPayload(1, 'mobile')), 100);
    assert.equal(extractPerformanceScore(psiPayload(0, 'mobile')), 0);
  });

  it('ignora payload sem lighthouse de performance (não usa CrUX nem outras categorias)', () => {
    assert.equal(extractPerformanceScore({ loadingExperience: { metrics: { CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 35 } } } }), null);
    assert.equal(
      extractPerformanceScore({
        lighthouseResult: { categories: { accessibility: { score: 0.96 } } },
      }),
      null
    );
  });
});

describe('formFactorFromReportUrl', () => {
  it('lê form_factor da URL do relatório', () => {
    assert.equal(
      formFactorFromReportUrl('https://pagespeed.web.dev/analysis/https-example-com/abc123?form_factor=mobile'),
      'mobile'
    );
    assert.equal(
      formFactorFromReportUrl('https://pagespeed.web.dev/analysis/https-example-com/abc123?form_factor=desktop'),
      'desktop'
    );
  });

  it('assume mobile quando a URL ainda não tem form_factor (padrão da UI)', () => {
    assert.equal(
      formFactorFromReportUrl('https://pagespeed.web.dev/analysis?url=https://example.com'),
      'mobile'
    );
  });
});

describe('selectScoreForReport', () => {
  it('escolhe o score do mesmo form_factor da URL, não o do outro dispositivo', () => {
    const results = [
      { formFactor: 'desktop' as const, score: 90 },
      { formFactor: 'mobile' as const, score: 35 },
    ];
    assert.equal(selectScoreForReport(results, 'mobile'), 35);
    assert.equal(selectScoreForReport(results, 'desktop'), 90);
  });

  it('não usa o score de desktop quando a URL é mobile e o JSON mobile ainda não chegou', () => {
    assert.equal(
      selectScoreForReport([{ formFactor: 'desktop', score: 90 }], 'mobile'),
      null
    );
  });
});

describe('formFactorFromPsiResponse', () => {
  it('lê o form factor do lighthouseResult', () => {
    assert.equal(formFactorFromPsiResponse(psiPayload(0.5, 'mobile')), 'mobile');
    assert.equal(formFactorFromPsiResponse(psiPayload(0.9, 'desktop')), 'desktop');
  });
});

describe('isPsiApiUrl', () => {
  it('reconhece os endpoints oficiais da API PageSpeed', () => {
    assert.equal(
      isPsiApiUrl('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&strategy=mobile'),
      true
    );
    assert.equal(
      isPsiApiUrl('https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=desktop'),
      true
    );
    assert.equal(isPsiApiUrl('https://www.google-analytics.com/g/collect'), false);
    assert.equal(
      isPsiApiUrl('https://pagespeed.web.dev/_/PagespeedUi/data/batchexecute?rpcids=LsX2he'),
      false
    );
  });
});

describe('parseGaugePercentage', () => {
  it('lê só o inteiro do medidor visível, não percentuais CrUX nem pesos de métrica', () => {
    assert.equal(parseGaugePercentage('35'), 35);
    assert.equal(parseGaugePercentage(' 100 '), 100);
    assert.equal(parseGaugePercentage('0'), 0);
    assert.equal(parseGaugePercentage('35%'), null);
    assert.equal(parseGaugePercentage('FCP+10'), null);
    assert.equal(parseGaugePercentage(''), null);
    assert.equal(parseGaugePercentage(null), null);
  });
});

describe('isReportPermalink', () => {
  it('distingue a URL estável do relatório da URL de loading', () => {
    assert.equal(
      isReportPermalink('https://pagespeed.web.dev/analysis/https-example-com/n8vr32bizz?form_factor=mobile'),
      true
    );
    assert.equal(
      isReportPermalink('https://pagespeed.web.dev/analysis?url=https://example.com'),
      false
    );
  });
});
