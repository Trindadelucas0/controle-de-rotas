# Módulo Lookups

Proxy autenticado para CNPJ/CEP (BrasilAPI) e sugestões de endereço (Nominatim). Usado pelo formulário de cliente.

## Endpoints

| Método | Path | Papéis |
| --- | --- | --- |
| GET | `/api/v1/lookups/cnpj/:cnpj` | ADMIN, MANAGER, SUPERVISOR, EMPLOYEE |
| GET | `/api/v1/lookups/cep/:cep` | idem |
| GET | `/api/v1/lookups/address?q=` | idem |

## Endpoint GET /api/v1/lookups/cnpj/:cnpj

- Auth: JWT cookie + roles acima
- Rate limit: upstream BrasilAPI; Redis cache 24h por CNPJ
- Path: só dígitos; deve ter 14 (400 `CNPJ_INVALID` se incompleto)
- Respostas:
  - 200 `{ "company": { document, name, tradeName, phone, email, street, number, complement, district, city, state, zipCode } }`
  - 404 `CNPJ_NOT_FOUND`
  - 429 `LOOKUP_RATE_LIMIT`
  - 502 `CNPJ_LOOKUP_FAILED`
- Side effects: cache Redis `lookup:cnpj:{cnpj}`
- Como testar: login → `GET /api/v1/lookups/cnpj/00000000000191`

## Endpoint GET /api/v1/lookups/cep/:cep

- Auth: JWT + roles
- Path: 8 dígitos (400 `CEP_INVALID`)
- Respostas:
  - 200 `{ "address": { zipCode, street, district, city, state, latitude, longitude } }` (lat/lng podem ser null)
  - 404 `CEP_NOT_FOUND`
  - 429 / 502 equivalentes
- Cache Redis 24h `lookup:cep:{cep}`
- Como testar: `GET /api/v1/lookups/cep/01310100`

## Endpoint GET /api/v1/lookups/address?q=

- Auth: JWT + roles
- Query: `q` min 3 caracteres
- Nominatim `countrycodes=br`, limit 5, User-Agent Rotas
- Respostas:
  - 200 `{ "suggestions": [ { label, street, number, district, city, state, zipCode, latitude, longitude } ] }`
  - 400 `ADDRESS_QUERY_SHORT`
  - 429 / 502
- Cache Redis 10 min `lookup:address:{q}`
- Como testar: `GET /api/v1/lookups/address?q=Avenida%20Paulista%20Sao%20Paulo`

## Telas que usam

- [customers.md](../screens/customers.md) — formulário novo/editar
