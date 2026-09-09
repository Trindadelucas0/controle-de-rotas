# Módulo Health

## Endpoint GET /api/v1/health

- Auth: público
- Rate limit: nenhum
- Body / Query: —
- Cookies set/clear: —
- Respostas 2xx: `{ "status": "ok"|"degraded", "db": boolean, "redis": boolean }`
- Side effects: `SELECT 1` via Prisma; `PING` Redis
- Como testar: `curl http://localhost:3001/api/v1/health` após `docker compose up -d` e API no ar

Critério de pronto: `status=ok` com `db=true` e `redis=true`.
