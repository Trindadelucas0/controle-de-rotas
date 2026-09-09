# Módulo Companies

API da empresa do usuário autenticado (Tema 02 + origem de rotas Tema 08).

Campos de localização: `latitude`, `longitude`, `location` (PostGIS), `locationStatus`. Pin **opcional** no PATCH (não bloqueia cadastro); necessário para `POST /routes/preview`.

## Endpoints

| Método | Path | Papéis |
| --- | --- | --- |
| GET | `/api/v1/companies/me` | qualquer autenticado |
| PATCH | `/api/v1/companies/me` | ADMIN |

### PATCH body (extras)

```json
{
  "address": "Rua Exemplo, 100",
  "latitude": -23.5505,
  "longitude": -46.6333
}
```

Contratos em [API.md](../API.md). Tela: [screens/settings-company.md](../screens/settings-company.md).
