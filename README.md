# PageSpeed Automation Service

Microserviço HTTP que analisa uma URL no [PageSpeed Insights](https://pagespeed.web.dev/), **repete a medição** e devolve o **melhor score de Performance** (0–100) — o mesmo inteiro do medidor da UI.

Documentação interativa (Swagger): **[/docs](http://localhost:8080/docs)**  
Spec OpenAPI: **[/openapi.json](http://localhost:8080/openapi.json)**

---

## Como funciona

O `score` e a `bestReportUrl` vêm **do mesmo relatório salvo** no PageSpeed Insights (`/analysis/{site}/{id}?form_factor=mobile`).

1. Abre o site, dispara a análise e espera o permalink com ID.
2. Lê o medidor visível de **Performance** (não Accessibility, CrUX nem Desktop escondido).
3. Se `runs > 1`, escolhe o run de maior score **e devolve a URL daquele run**.

Abrir `bestReportUrl` deve mostrar o mesmo número. Use a aba **Mobile** se `strategy=mobile` (padrão). Desktop é outra medição.

Não usamos a API REST do Google no resultado que você compara com o site: ela não gera esse permalink. Um link `analysis?url=...` (sem ID) **roda de novo** e o score muda.

---

## Requisitos

- Node.js 18+
- Playwright / Chromium (`npx playwright install chromium`)

## Instalação

```bash
npm install
npx playwright install chromium
```

## Configuração

Crie um `.env` na raiz:

```env
PORT=8080
PAGESPEED_RUNS=3
```

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta HTTP | `8000` |
| `PAGESPEED_RUNS` | Runs padrão se a request não enviar `runs` | `3` |
| `USE_SYSTEM_CHROME` | Força Chrome/Chromium do sistema | desligado |

A chave da [API PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started?hl=pt-br) **não entra no `score`/`bestReportUrl`**: esses campos vêm do relatório salvo no site, para o número bater com o link.

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

Timeout da análise: até ~90s por run (tempo do Lighthouse no site). `runs` é sequencial.

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
  "bestReportUrl": "https://pagespeed.web.dev/analysis/https-example-com/abc123xyz?form_factor=mobile",
  "bestPerformanceScore": 100,
  "score": 100,
  "totalRuns": 3,
  "runs": [
    {
      "runIndex": 1,
      "reportUrl": "https://pagespeed.web.dev/analysis/https-example-com/abc123xyz?form_factor=mobile",
      "performanceScore": 100,
      "score": 100
    }
  ]
}
```

| Campo | Significado |
|---|---|
| `score` / `bestPerformanceScore` | Inteiro do medidor de Performance daquele relatório (0–100) |
| `strategy` | `mobile` ou `desktop` usado na medição |
| `bestReportUrl` | Permalink **com ID** (`/analysis/{site}/{id}`). Abrir deve mostrar o mesmo score |
| `runs` | Cada tentativa (`score` e `performanceScore` são o mesmo número) |

**Mobile e desktop não são comparáveis.** Se você olha Desktop no site, chame `strategy=desktop`.

Se a `bestReportUrl` for só `analysis?url=...` (sem ID), o site vai rodar de novo e o número muda. O serviço espera o permalink com ID antes de devolver.

### Erros

| HTTP | Quando |
|---|---|
| `400` | Faltou `url` |
| `500` | Falha ao abrir o PageSpeed Insights ou ler o medidor |

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

A primeira chamada costuma levar 30–90s (tempo do Lighthouse no site).

---

## Docker

```bash
docker build -t pagespeed-automation-service .
docker run --rm -p 8080:8080 --env-file .env pagespeed-automation-service
```

---

## Playwright no Linux (WSL / container)

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
