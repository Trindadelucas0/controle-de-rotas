# Módulo Companies

API da empresa do usuário autenticado + provisionamento multi-tenant (PLATFORM_ADMIN).

Campos de localização: `latitude`, `longitude`, `location` (PostGIS), `locationStatus`. Pin **opcional** no PATCH (não bloqueia cadastro); necessário para `POST /routes/preview`.

## Endpoints

| Método | Path | Papéis |
| --- | --- | --- |
| GET | `/api/v1/companies/me` | qualquer autenticado |
| PATCH | `/api/v1/companies/me` | ADMIN (PLATFORM_ADMIN herda) |
| GET | `/api/v1/companies` | PLATFORM_ADMIN |
| POST | `/api/v1/companies` | PLATFORM_ADMIN |
| GET | `/api/v1/companies/:id` | PLATFORM_ADMIN |
| PATCH | `/api/v1/companies/:id` | PLATFORM_ADMIN |

### POST body (nova empresa + admin inicial)

```json
{
  "name": "Cliente XYZ",
  "tradeName": "XYZ",
  "document": "123",
  "adminName": "Admin XYZ",
  "adminEmail": "admin@xyz.local",
  "adminPassword": "ChangeMe123!"
}
```

Cria `Company` ACTIVE + `User` ADMIN na mesma transação. E-mail do admin é único na plataforma.

### PATCH body (extras)

```json
{
  "address": "Rua Exemplo, 100",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "status": "INACTIVE"
}
```

Contratos em [API.md](../API.md). Telas: [screens/settings-company.md](../screens/settings-company.md), [screens/settings-companies.md](../screens/settings-companies.md).
