export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PageSpeed Automation API',
    version: '1.0.0',
    description: [
      'O `score` e a `bestReportUrl` vêm **do mesmo relatório salvo** (`/analysis/{site}/{id}?form_factor=...`). Abrir o link deve mostrar o mesmo medidor de Performance.',
      '',
      '### Como funciona',
      '1. Abre [pagespeed.web.dev](https://pagespeed.web.dev/) e espera o permalink com ID.',
      '2. Lê o medidor visível de Performance (não CrUX, Accessibility nem Desktop escondido).',
      '3. Se `runs > 1`, escolhe o maior score e devolve **a URL daquele run**.',
      '4. Padrão `strategy=mobile` (aba padrão do site). Desktop é outra medição.',
      '',
      'Um link `analysis?url=...` (sem ID) dispara análise nova e o número muda. Este serviço não devolve esse link como resultado.',
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
            description: 'Permalink do relatório salvo (`/analysis/{site}/{id}`). Abrir deve mostrar o mesmo score.',
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
            description: 'Permalink com ID do melhor run. Não é `analysis?url=` (esse link roda de novo).',
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
              bestReportUrl: 'https://pagespeed.web.dev/analysis/https-example-com/abc123xyz?form_factor=mobile',
              bestPerformanceScore: 100,
              score: 100,
              totalRuns: 3,
              runs: [
                {
                  runIndex: 1,
                  reportUrl: 'https://pagespeed.web.dev/analysis/https-example-com/abc123xyz?form_factor=mobile',
                  performanceScore: 100,
                  score: 100,
                },
                {
                  runIndex: 2,
                  reportUrl: 'https://pagespeed.web.dev/analysis/https-example-com/abc123xyz?form_factor=mobile',
                  performanceScore: 99,
                  score: 99,
                },
                {
                  runIndex: 3,
                  reportUrl: 'https://pagespeed.web.dev/analysis/https-example-com/abc123xyz?form_factor=mobile',
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
