# PageSpeed Automation Service

Microserviço em TypeScript que, ao receber uma URL, executa várias análises no [PageSpeed Insights](https://pagespeed.web.dev/) e devolve a **URL do relatório** com a melhor métrica (performance).

## Requisitos

- Node.js 18+
- Playwright (os browsers são instalados com `npx playwright install`)

## Instalação

```bash
npm install
npx playwright install chromium
```

## Configuração

| Variável / Parâmetro | Descrição | Padrão |
|---------------------|-----------|--------|
| `PORT` | Porta do servidor HTTP | `8000` |
| `PAGESPEED_RUNS` | Número de execuções (se não passar `runs` na requisição) | `10` |
| `runs` (query ou body) | Número de análises a executar (entre 1 e 50) | `10` |

## Uso

### Iniciar o servidor

```bash
npm run dev
# ou
npm run build && npm start
```

### GET – passar URL e número de runs na query

```bash
curl "http://localhost:8000/analyze?url=https://example.com&runs=10"
```

### POST – passar URL e runs no body

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","runs":5}'
```

### Resposta de sucesso

```json
{
  "urlAnalyzed": "https://example.com",
  "bestReportUrl": "https://pagespeed.web.dev/analysis?url=...",
  "bestPerformanceScore": 92,
  "totalRuns": 10,
  "runs": [
    { "runIndex": 1, "reportUrl": "...", "performanceScore": 88 },
    ...
  ]
}
```

- **bestReportUrl**: URL do relatório no PageSpeed com a melhor pontuação de performance.
- **bestPerformanceScore**: Score de performance (0–100) do melhor run, quando disponível.
- **runs**: Lista de todos os runs com `reportUrl` e `performanceScore` (quando extraído).

O número de tentativas é **editável**: use `runs` na query (GET), no body (POST) ou a variável de ambiente `PAGESPEED_RUNS` (entre 1 e 50).

---

## Erro `libnspr4.so` / "Target page, context or browser has been closed"

Em alguns ambientes Linux (ex.: WSL2, containers mínimos), o Chromium instalado pelo Playwright depende de bibliotecas do sistema que podem não estar instaladas (`libnspr4.so`, `libnss3.so`, etc.).

### Opção 1 – Instalar dependências do sistema (recomendado)

```bash
npx playwright install-deps
```

Requer permissão de administrador. Em Debian/Ubuntu você pode instalar manualmente:

```bash
sudo apt-get update
sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

### Opção 2 – Usar o Chrome/Chromium instalado no sistema

Se o Chrome ou Chromium já estiver instalado na máquina, o serviço tenta usá-lo automaticamente quando o bundle do Playwright falha. Para forçar o uso do browser do sistema desde o início:

```bash
USE_SYSTEM_CHROME=1 npm run dev
```
