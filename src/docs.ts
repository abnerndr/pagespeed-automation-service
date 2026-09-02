import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi';

const customCss = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --psi-bg: #0b1220;
  --psi-panel: #121a2b;
  --psi-card: #182338;
  --psi-line: #2a3754;
  --psi-text: #e8eefc;
  --psi-muted: #93a0bb;
  --psi-accent: #0cce6b;
  --psi-accent-2: #7b61ff;
}

body {
  background: var(--psi-bg) !important;
}

.swagger-ui {
  font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  color: var(--psi-text);
}

.swagger-ui .topbar {
  background: linear-gradient(90deg, #0b1220 0%, #15243c 100%);
  border-bottom: 1px solid var(--psi-line);
  padding: 10px 0;
}

.swagger-ui .topbar .download-url-wrapper { display: none; }
.swagger-ui .topbar-wrapper img { display: none; }
.swagger-ui .topbar-wrapper::before {
  content: 'PageSpeed Automation API';
  color: var(--psi-text);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.02em;
  padding-left: 12px;
}

.swagger-ui .information-container.wrapper {
  margin: 24px 0 8px;
}

.swagger-ui .info {
  margin: 0;
  padding: 28px;
  background: var(--psi-panel);
  border: 1px solid var(--psi-line);
  border-radius: 16px;
}

.swagger-ui .info .title {
  color: var(--psi-text);
  font-size: 32px;
  font-weight: 700;
}

.swagger-ui .info p, .swagger-ui .info li, .swagger-ui .markdown p, .swagger-ui .renderedMarkdown p {
  color: var(--psi-muted);
}

.swagger-ui .info a { color: var(--psi-accent); }

.swagger-ui .scheme-container {
  background: transparent;
  box-shadow: none;
  padding: 12px 0;
}

.swagger-ui .opblock-tag {
  color: var(--psi-text);
  border-bottom: 1px solid var(--psi-line);
  font-size: 18px;
}

.swagger-ui .opblock {
  background: var(--psi-card);
  border: 1px solid var(--psi-line);
  border-radius: 12px;
  box-shadow: none;
}

.swagger-ui .opblock .opblock-summary-path { color: var(--psi-text); }
.swagger-ui .opblock .opblock-summary-description { color: var(--psi-muted); }

.swagger-ui .opblock.opblock-get { border-color: #3b82f6; }
.swagger-ui .opblock.opblock-post { border-color: var(--psi-accent); }

.swagger-ui .btn.execute {
  background: var(--psi-accent);
  border-color: var(--psi-accent);
  color: #052e16;
  font-weight: 700;
  border-radius: 8px;
}

.swagger-ui .btn.execute:hover { filter: brightness(1.08); }

.swagger-ui .btn.try-out__btn {
  border-color: var(--psi-accent-2);
  color: #c4b5ff;
  border-radius: 8px;
}

.swagger-ui select, .swagger-ui input[type=text], .swagger-ui textarea {
  background: #0e1626 !important;
  color: var(--psi-text) !important;
  border: 1px solid var(--psi-line) !important;
  border-radius: 8px !important;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
}

.swagger-ui .parameter__name, .swagger-ui table thead tr td, .swagger-ui table thead tr th {
  color: var(--psi-text);
}

.swagger-ui .response-col_status, .swagger-ui .response-col_description { color: var(--psi-muted); }

.swagger-ui .model-box, .swagger-ui section.models {
  background: var(--psi-panel);
  border: 1px solid var(--psi-line);
  border-radius: 12px;
}

.swagger-ui section.models h4, .swagger-ui .model-title, .swagger-ui .model {
  color: var(--psi-text);
}

.swagger-ui .highlight-code, .swagger-ui .microlight {
  background: #0a1020 !important;
  border-radius: 10px;
}

.swagger-ui .opblock-body pre.microlight {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
}

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 8px; }
`;

export function mountDocs(app: Express): void {
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec as unknown as Record<string, unknown>, {
      customCss,
      customSiteTitle: 'PageSpeed Automation API',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
        syntaxHighlight: { activate: true, theme: 'tomorrow-night' },
      },
    })
  );
}
