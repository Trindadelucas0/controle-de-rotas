# Módulo Vehicles

CRUD de frota (Tema 05). Placa única por empresa.

## Endpoints

| Método | Path | Papéis |
| --- | --- | --- |
| GET | `/api/v1/vehicles` | ADMIN, MANAGER |
| POST | `/api/v1/vehicles` | ADMIN, MANAGER |
| GET | `/api/v1/vehicles/:id` | ADMIN, MANAGER |
| PATCH | `/api/v1/vehicles/:id` | ADMIN, MANAGER |
| GET | `/api/v1/vehicles/:id/odometer-readings` | ADMIN, MANAGER, SUPERVISOR |

Contratos em [API.md](../API.md).
