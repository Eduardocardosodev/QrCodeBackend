# Backend Plaquinha

Backend do SaaS de reputação e feedback de clientes, desenvolvido com NestJS, Prisma e PostgreSQL.

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Ajuste a variável `DATABASE_URL` no `.env`.

4. Gere o client do Prisma e aplique as migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Inicie a aplicação:

```bash
npm run start:dev
```

A API ficará disponível em `http://localhost:3000`.

## Módulo de Estabelecimento

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/establishments` | Cria um estabelecimento |
| `GET` | `/establishments` | Lista estabelecimentos |
| `GET` | `/establishments/:id` | Busca um estabelecimento |
| `PATCH` | `/establishments/:id` | Atualiza um estabelecimento |
| `DELETE` | `/establishments/:id` | Remove um estabelecimento |

## Módulo de QR Point

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/qr-points` | Cria uma plaquinha com token público |
| `GET` | `/qr-points/token/:token` | Busca QR Point por token |
| `PATCH` | `/qr-points/:id/activate` | Ativa QR Point para um estabelecimento |
| `PATCH` | `/qr-points/:id/deactivate` | Desativa QR Point |

### Exemplo de ativação

```bash
curl -X PATCH http://localhost:3000/qr-points/{id}/activate \
  -H "Content-Type: application/json" \
  -d '{
    "establishmentId": "uuid-do-estabelecimento"
  }'
```

## Módulo de Feedback

### Endpoints públicos

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/feedbacks/:token/context` | Retorna contexto do formulário |
| `POST` | `/feedbacks/:token` | Registra feedback do cliente |

### Tags disponíveis

- `SERVICE` — Atendimento
- `QUALITY` — Qualidade
- `ENVIRONMENT` — Ambiente
- `PRICE` — Preço
- `WAIT_TIME` — Tempo de espera

### Exemplo de envio de feedback

```bash
curl -X POST http://localhost:3000/feedbacks/{token} \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Ótimo atendimento",
    "tags": ["SERVICE", "QUALITY"]
  }'
```

### Exemplo de contexto do formulário

```bash
curl http://localhost:3000/feedbacks/{token}/context
```

## Arquitetura

Os módulos seguem Clean Architecture:

- `domain`: entidades e contratos de repositório
- `application`: casos de uso
- `infra`: implementação com Prisma
- `presentation`: controller e DTOs

## Módulo de Analytics

### Endpoints autenticados

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/analytics/summary?from=&to=` | Total geral e totais por QR Code |
| `GET` | `/analytics/metrics?from=&to=&qrCodeId=` | Agregações para gráficos |
| `DELETE` | `/qr-codes/:id` | Exclusão lógica de QR Code |
| `GET` | `/analytics/qr-codes/:id?from=&to=` | Resumo de um QR Code |
| `GET` | `/analytics/qr-codes/:id/scans?from=&to=&page=&limit=` | Eventos detalhados paginados |

`/analytics/metrics` retorna `totalScans`, agregações por dispositivo, navegador e
sistema operacional, além da timeline diária:

```json
{
  "totalScans": 1250,
  "byDevice": {
    "mobile": 800,
    "desktop": 350,
    "tablet": 80,
    "unknown": 20
  },
  "byBrowser": {
    "Safari": 500,
    "Chrome": 600
  },
  "byOperatingSystem": {
    "iOS": 480,
    "Android": 320
  },
  "byCountry": {
    "Brazil": 900
  },
  "byState": {
    "Sao Paulo": 500
  },
  "byCity": {
    "Sao Paulo": 420
  },
  "timeline": [
    {
      "date": "2026-09-09",
      "totalScans": 125
    }
  ]
}
```

Use `qrCodeId` para filtrar as métricas de um QR Code específico. A rota
`/analytics/qr-codes/:id/scans` continua sendo exclusiva para consulta
detalhada e paginada dos eventos individuais.

### Coleta de scans

Cada acesso a `GET /redirects/:slug` registra um evento com:

- dispositivo (`mobile`, `tablet`, `desktop`, `unknown`)
- sistema operacional
- navegador
- user-agent
- referer
- IP anonimizado via hash

Falhas no analytics não impedem o redirect.

### Variáveis de ambiente

```env
SCAN_EVENTS_IP_HASH_SECRET="change-me-scan-events-ip-hash-secret"
SCAN_EVENTS_RETENTION_DAYS="90"
```

`SCAN_EVENTS_RETENTION_DAYS` documenta a política de retenção planejada. A limpeza automática ainda não está habilitada nesta versão.

Para geolocalização sem custo por consulta, baixe o arquivo `GeoLite2-City.mmdb` da MaxMind e configure `GEOLITE2_CITY_DB_PATH`. Sem esse arquivo, os scans continuam sendo registrados, mas `country`, `state` e `city` ficam nulos.

A exclusão de QR Code é lógica (`isActive = false`). O histórico de scans é preservado, mas o QR Code deixa de aparecer na listagem e o redirect público passa a retornar `404`.

## Scripts úteis

```bash
npm run build
npm run lint
npm run test
npm run prisma:studio
```
