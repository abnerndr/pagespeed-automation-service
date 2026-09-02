export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PageSpeed Automation API',
    version: '1.0.0',
    description: [
      'Analisa uma URL no **PageSpeed Insights**, repete a medição e devolve o **melhor score de Performance** (0–100), igual ao medidor da UI.',
      '',
      '### Como funciona',
      '1. Chama a [API oficial do Google](https://developers.google.com/speed/docs/insights/v5/get-started?hl=pt-br) (`runPagespeed`).',
      '2. Converte `lighthouseResult.categories.performance.score` (0–1) com `Math.round` → inteiro 0–100.',
      '3. Usa `strategy=mobile` por padrão (mesma aba padrão de [pagespeed.web.dev](https://pagespeed.web.dev/)).',
      '4. Sem `PAGESPEED_API_KEY` (ou com HTTP 429), cai no site via Playwright.',
      '',
      '### Chave do Google (recomendado)',
      'Gere a chave gratuita em [Começar a usar a API PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started?hl=pt-br) e defina `PAGESPEED_API_KEY` no `.env`. Sem ela a API do Google limita as chamadas e o serviço fica mais lento.',
    ].join('\n'),
    contact: {
      name: 'PageSpeed Automation Service',
    },
  },
  servers: [
    { url: '/', description: 'Este servidor' },
  ],
  tags: [
    { name: 'Análise', description: 'Rodar PageSpeed e obter o melhor score' },
    { name: 'Status', description: 'Saúde do serviço' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Status'],
        summary: 'Health check',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Serviço no ar',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: { status: 'ok', service: 'pagespeed-automation-service' },
              },
            },
          },
        },
      },
    },
    '/analyze': {
      get: {
        tags: ['Análise'],
        summary: 'Analisar URL (GET)',
        description: 'Executa `runs` medições e retorna o melhor score de Performance.',
        operationId: 'analyzeGet',
        parameters: [
          { $ref: '#/components/parameters/UrlQuery' },
          { $ref: '#/components/parameters/RunsQuery' },
          { $ref: '#/components/parameters/StrategyQuery' },
        ],
        responses: {
          '200': { $ref: '#/components/responses/AnalyzeOk' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '500': { $ref: '#/components/responses/AnalyzeError' },
        },
      },
      post: {
        tags: ['Análise'],
        summary: 'Analisar URL (POST)',
        description: 'Igual ao GET, com parâmetros no JSON. Útil para n8n, Zapier e backends.',
        operationId: 'analyzePost',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AnalyzeRequest' },
              examples: {
                mobile: {
                  summary: 'Mobile, 3 runs',
                  value: { url: 'https://example.com', runs: 3, strategy: 'mobile' },
                },
                desktop: {
                  summary: 'Desktop',
                  value: { url: 'https://example.com', runs: 3, strategy: 'desktop' },
                },
              },
            },
          },
        },
        responses: {
          '200': { $ref: '#/components/responses/AnalyzeOk' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '500': { $ref: '#/components/responses/AnalyzeError' },
        },
      },
    },
  },
  components: {
    parameters: {
      UrlQuery: {
        name: 'url',
        in: 'query',
        required: true,
        description: 'URL a analisar. Se vier sem `http://` ou `https://`, o serviço prefixa `https://`.',
        schema: { type: 'string', example: 'https://example.com' },
      },
      RunsQuery: {
        name: 'runs',
        in: 'query',
        required: false,
        description: 'Quantas vezes repetir a análise (1–50). Padrão: 3, ou `PAGESPEED_RUNS`.',
        schema: { type: 'integer', minimum: 1, maximum: 50, default: 3, example: 3 },
      },
      StrategyQuery: {
        name: 'strategy',
        in: 'query',
        required: false,
        description: 'Dispositivo simulado. `mobile` é o padrão da UI do PageSpeed. Desktop costuma ter score mais alto — não misture os dois.',
        schema: { type: 'string', enum: ['mobile', 'desktop'], default: 'mobile' },
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        required: ['status', 'service'],
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'pagespeed-automation-service' },
        },
      },
      AnalyzeRequest: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', example: 'https://example.com' },
          runs: { type: 'integer', minimum: 1, maximum: 50, default: 3, example: 3 },
          strategy: { type: 'string', enum: ['mobile', 'desktop'], default: 'mobile' },
        },
      },
      AnalyzeRun: {
        type: 'object',
        properties: {
          runIndex: { type: 'integer', example: 1 },
          reportUrl: {
            type: 'string',
            format: 'uri',
            description: 'Link do PageSpeed Insights para essa URL e form_factor. Abrir no browser dispara uma análise nova na UI.',
          },
          performanceScore: { type: 'integer', nullable: true, minimum: 0, maximum: 100, example: 92 },
          score: { type: 'integer', nullable: true, minimum: 0, maximum: 100, example: 92 },
        },
      },
      AnalyzeResponse: {
        type: 'object',
        required: ['urlAnalyzed', 'strategy', 'bestReportUrl', 'totalRuns', 'runs'],
        properties: {
          urlAnalyzed: { type: 'string', example: 'https://example.com' },
          strategy: { type: 'string', enum: ['mobile', 'desktop'], example: 'mobile' },
          bestReportUrl: {
            type: 'string',
            format: 'uri',
            description: 'Link do relatório no pagespeed.web.dev (mesmo form_factor da análise).',
          },
          bestPerformanceScore: { type: 'integer', nullable: true, minimum: 0, maximum: 100, example: 92 },
          score: {
            type: 'integer',
            nullable: true,
            minimum: 0,
            maximum: 100,
            description: 'Melhor score de Performance (0–100). Igual a `bestPerformanceScore`.',
            example: 92,
          },
          totalRuns: { type: 'integer', example: 3 },
          runs: { type: 'array', items: { $ref: '#/components/schemas/AnalyzeRun' } },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          example: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    responses: {
      AnalyzeOk: {
        description: 'Análise concluída',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AnalyzeResponse' },
            example: {
              urlAnalyzed: 'https://example.com',
              strategy: 'mobile',
              bestReportUrl: 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fexample.com&form_factor=mobile',
              bestPerformanceScore: 100,
              score: 100,
              totalRuns: 3,
              runs: [
                {
                  runIndex: 1,
                  reportUrl: 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fexample.com&form_factor=mobile',
                  performanceScore: 100,
                  score: 100,
                },
                {
                  runIndex: 2,
                  reportUrl: 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fexample.com&form_factor=mobile',
                  performanceScore: 99,
                  score: 99,
                },
                {
                  runIndex: 3,
                  reportUrl: 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fexample.com&form_factor=mobile',
                  performanceScore: 100,
                  score: 100,
                },
              ],
            },
          },
        },
      },
      BadRequest: {
        description: 'Faltou `url`',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              error: 'Parâmetro "url" é obrigatório',
              example: '/analyze?url=https://example.com&runs=3&strategy=mobile',
            },
          },
        },
      },
      AnalyzeError: {
        description: 'Falha na API do Google e/ou no fallback do site',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              error: 'Erro ao executar análises no PageSpeed',
              message: 'PageSpeed API HTTP 429',
            },
          },
        },
      },
    },
  },
} as const;
