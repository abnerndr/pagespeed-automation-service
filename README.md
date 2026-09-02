# PageSpeed Automation Service

Microserviço HTTP que analisa uma URL no [PageSpeed Insights](https://pagespeed.web.dev/), **repete a medição** e devolve o **melhor score de Performance** (0–100) — o mesmo inteiro do medidor da UI.

Documentação interativa (Swagger): **[/docs](http://localhost:8080/docs)**  
Spec OpenAPI: **[/openapi.json](http://localhost:8080/openapi.json)**

---

## Como funciona

1. Chama a [API oficial do Google](https://developers.google.com/speed/docs/insights/v5/get-started?hl=pt-br) (`pagespeedonline/v5/runPagespeed`).
2. Lê `lighthouseResult.categories.performance.score` (0–1) e aplica `Math.round` → **0–100**.
3. Usa **`mobile`** por padrão (aba padrão do site). Desktop é outra medição.
4. Se não houver chave, ou a API responder **429**, o serviço cai no site via Playwright (mais lento).

Para o caminho rápido e estável, use `PAGESPEED_API_KEY`.

---

## Requisitos

- Node.js 18+
- Chave da PageSpeed Insights API (recomendado)
- Playwright / Chromium só no **fallback** (quando a API do Google falha)

## Instalação

```bash
npm install
npx playwright install chromium   # só necessário para o fallback
```

## Configuração

Crie um `.env` na raiz:

```env
PORT=8080
PAGESPEED_API_KEY=sua_chave_aqui
PAGESPEED_RUNS=3
```

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta HTTP | `8000` |
| `PAGESPEED_API_KEY` | Chave da API do Google (`PSI_API_KEY` também vale) | vazio (fallback no site) |
| `PAGESPEED_RUNS` | Runs padrão se a request não enviar `runs` | `3` |
| `USE_SYSTEM_CHROME` | Força Chrome/Chromium do sistema no fallback | desligado |

### Como gerar a chave do Google

A chave gratuita é gerada nesta página:

**[Começar a usar a API PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started?hl=pt-br)**

1. Abra o link acima e clique em **Gerar uma chave**.
2. Crie (ou escolha) um projeto no Google Cloud.
3. Ative **PageSpeed Insights API**.
4. Cole a chave em `PAGESPEED_API_KEY` no `.env`.

Sem chave, o Google limita as chamadas. O serviço tenta a API e, se falhar, abre o site (lento).

---

## Subir o servidor

```bash
npm run dev
# ou
npm run build && npm start
```

Com `PORT=8080`:

| Recurso | URL |
|---|---|
| Swagger UI | http://localhost:8080/docs |
| OpenAPI JSON | http://localhost:8080/openapi.json |
| Health | http://localhost:8080/health |
| Analisar | http://localhost:8080/analyze |

---

## API deste serviço

Timeout da análise: até ~2 minutos por run na API do Google. Com chave, vários runs vão **em paralelo** (até 3).

### `GET /health`

```bash
curl http://localhost:8080/health
```

```json
{ "status": "ok", "service": "pagespeed-automation-service" }
```

### `GET /analyze`

| Query | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `url` | sim | — | Página a medir. Sem protocolo, vira `https://` |
| `runs` | não | `3` (1–50) | Quantas vezes repetir; devolve o **melhor** score |
| `strategy` | não | `mobile` | `mobile` ou `desktop` |

```bash
curl "http://localhost:8080/analyze?url=https://example.com&runs=3&strategy=mobile"
```

### `POST /analyze`

Body JSON:

```json
{
  "url": "https://example.com",
  "runs": 3,
  "strategy": "mobile"
}
```

```bash
curl -X POST http://localhost:8080/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","runs":3,"strategy":"mobile"}'
```

### Resposta 200

```json
{
  "urlAnalyzed": "https://example.com",
  "strategy": "mobile",
  "bestReportUrl": "https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fexample.com&form_factor=mobile",
  "bestPerformanceScore": 100,
  "score": 100,
  "totalRuns": 3,
  "runs": [
    {
      "runIndex": 1,
      "reportUrl": "https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fexample.com&form_factor=mobile",
      "performanceScore": 100,
      "score": 100
    }
  ]
}
```

| Campo | Significado |
|---|---|
| `score` / `bestPerformanceScore` | Melhor Performance 0–100 (`Math.round` do JSON do Google) |
| `strategy` | `mobile` ou `desktop` usado na medição |
| `bestReportUrl` | Link do PageSpeed Insights nessa URL + form factor |
| `runs` | Cada tentativa (`score` e `performanceScore` são o mesmo número) |

**Mobile e desktop não são comparáveis.** Se você olha Desktop no site, chame `strategy=desktop`.

**Abrir `bestReportUrl` no browser dispara uma análise nova na UI.** O Lighthouse de laboratório varia entre runs. O número confiável desta API é o `score` da response, não o que a página mostrar depois.

### Erros

| HTTP | Quando |
|---|---|
| `400` | Faltou `url` |
| `500` | API do Google e fallback do site falharam |

```json
{
  "error": "Erro ao executar análises no PageSpeed",
  "message": "PageSpeed API HTTP 429"
}
```

---

## Testar no Swagger

1. Suba o servidor e abra http://localhost:8080/docs
2. Em **GET /analyze**, clique **Try it out**
3. Preencha `url` (ex.: `https://example.com`), `runs=1`, `strategy=mobile`
4. **Execute**

A primeira chamada com chave costuma levar 15–40s (tempo do Lighthouse no Google).

---

## Docker

```bash
docker build -t pagespeed-automation-service .
docker run --rm -p 8080:8080 --env-file .env pagespeed-automation-service
```

---

## Fallback Playwright (sem chave / 429)

O Chromium do Playwright precisa de libs no Linux (WSL, container mínimo):

```bash
npx playwright install-deps
```

Ou force o Chrome do sistema:

```bash
USE_SYSTEM_CHROME=1 npm run dev
```

---

## Scripts

```bash
npm run dev     # ts-node
npm test        # testes
npm run build   # dist/
npm start       # node dist/index.js
```
