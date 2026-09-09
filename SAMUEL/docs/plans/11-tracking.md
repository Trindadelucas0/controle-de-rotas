# Tema 11 — Tracking (HTTP) — modelo oficial

**Status:** done (evoluído 28/08/2026 — watchPosition + amostragem)

## Modelo (alinhado ao desenho do produto)

```
Funcionário PWA
      │ navigator.geolocation.watchPosition()
      ▼
Latitude / Longitude (+ accuracy, speed, heading)
      │ HTTPS POST (amostrado: ≥15 m OU ≥10 s)
      ▼
POST /api/v1/tracking/points   ← mesmo papel de “POST /location”
      │ JWT → user → employee → companyId → rota IN_PROGRESS
      ├── Redis tracking:current:{company}:{employee}  (agora, TTL 120s)
      └── PostGIS tracking_points  (histórico amostrado: ≥25 m OU ≥15 s)
                │
                ▼
         GET /tracking/live (poll ~4s no mapa do gestor)
         WebSocket = fase seguinte (não bloqueia MVP)
```

## Regras

- Browser **não** envia GPS sozinho: o JS chama `watchPosition` e o front faz POST.
- Sem rota `IN_PROGRESS` → `TRACKING_ROUTE_NOT_ACTIVE`.
- `employeeId` **não** vem do body — só do JWT.
- Tracking operacional **só com rota ativa** (Play → … → Concluir).
- Background 24h / app fechado → **fora do PWA MVP** (app nativo depois).
- HTTPS (ou localhost) obrigatório no iPhone para Geolocation.

## Escopo entregue

- Captura: `watchPosition` (`startRouteGpsWatch` em `field-tracking.ts`)
- Transporte: HTTP `POST /tracking/points`, `GET /tracking/live`
- Agora: Redis; Histórico: PostGIS amostrado
- Sem WebSocket neste bloco

## Aceite

- [x] Sem Play → pontos rejeitados
- [x] Isolamento `companyId`
- [x] Redis atualiza a cada POST aceito; PostGIS não a cada tick
- [x] Mapa gestor via poll HTTP

## Próximo (não neste tema)

- WebSocket `employee.location.updated`
- Frequência adaptativa por estado (parado / atendimento)
- Worker/buffer separado se volume subir
