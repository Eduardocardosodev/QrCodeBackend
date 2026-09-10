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

## Módulo de QR Codes

### Endpoints autenticados

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/qr-codes?page=1&limit=20&isInUse=false` | Lista QR Codes ativos paginados |
| `POST` | `/qr-codes` | Cria um QR Code |
| `POST` | `/qr-codes/batch` | Cria lote de QR Codes |
| `PATCH` | `/qr-codes/:id` | Atualiza `name`, `address`, `destinationUrl` e/ou `isInUse` |
| `DELETE` | `/qr-codes/:id` | Exclusão lógica de QR Code |
| `GET` | `/folders` | Lista pastas do usuário |

### Rota pública

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/redirects/:slug` | Redirect 302 para o destino atual |

### Criação em lote

```bash
curl -X POST http://localhost:3000/qr-codes/batch \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "prefix": "Cliente",
    "quantity": 100,
    "destinationUrl": "https://example.com/padrao",
    "folderId": "uuid-da-pasta",
    "color": "#000000"
  }'
```

Regras do lote:

- `prefix` gera nomes sequenciais: `Cliente 1`, `Cliente 2`, etc.
- `quantity` aceita valores entre `1` e `1000`.
- `destinationUrl`, `folderId` e `color` são iguais para todos os itens.
- `folderId` deve pertencer ao usuário autenticado.
- A operação é atômica: se houver falha, nenhum QR Code do lote é criado.

Resposta `201`:

```json
{
  "count": 100,
  "items": [
    {
      "id": "uuid",
      "name": "Cliente 1",
      "destinationUrl": "https://example.com/padrao",
      "address": "Rua Principal, 100",
      "folder": "Clientes",
      "color": "#000000",
      "isInUse": false,
      "publicUrl": "http://localhost:3000/redirects/abc12345",
      "createdAt": "2026-09-10T14:00:00.000Z"
    }
  ]
}
```

Novos QR Codes são criados com `isInUse: false`. O campo `address` é opcional para permitir gerar QR Codes de estoque antes de vinculá-los a um estabelecimento. Use `PATCH /qr-codes/:id` para atualizar o nome, endereço ou marcar como vendido/em uso:

```bash
curl -X PATCH http://localhost:3000/qr-codes/{id} \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Unidade Centro",
    "address": "Avenida Central, 200",
    "isInUse": true
  }'
```

Use `GET /folders` para obter o `folderId` de uma pasta existente antes de criar o lote.

### CRUD de pastas

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/folders` | Cria uma pasta |
| `GET` | `/folders` | Lista as pastas do usuário |

`GET /qr-codes` aceita `page` a partir de `1`, `limit` entre `1` e `100` e o filtro opcional `isInUse=true|false`.
Sem `isInUse`, a API retorna todos os QR Codes ativos.
O retorno possui `items`, `page`, `limit`, `total` e `totalPages`:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Cardápio",
      "destinationUrl": "https://example.com/menu",
      "folder": "Clientes",
      "color": "#000000",
      "isInUse": false,
      "publicUrl": "http://localhost:3000/redirects/abc12345",
      "createdAt": "2026-09-10T14:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 45,
  "totalPages": 3
}
```
| `GET` | `/folders/:id` | Busca uma pasta do usuário |
| `PATCH` | `/folders/:id` | Renomeia uma pasta |
| `DELETE` | `/folders/:id` | Exclui uma pasta |

Todas as rotas exigem Bearer token. A exclusão da pasta preserva os QR Codes
associados, deixando-os sem pasta.

Exemplo:

```bash
curl -X POST http://localhost:3000/folders \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Clientes"}'
```

O nome da pasta é único por usuário. Criar ou renomear para um nome já
existente retorna `409 Conflict`.

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
