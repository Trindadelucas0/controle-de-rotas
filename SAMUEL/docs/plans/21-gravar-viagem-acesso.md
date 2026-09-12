# Tema 21 — Gravar viagem + marcos de acesso à fazenda

**Status:** done (2026-09-04); furos de perda da trilha fechados em **v0.15.3** (2026-09-06).

**Dependências:** pin do cliente (06b), tracking (11), visita/check-in (12), rota por clientes (17), navegação (10/17).

## Escopo entregue

1. **Cadastro de cliente** — Lat/Lng digitáveis sincronizados com o pin; CEP opcional; pin continua obrigatório para rotas.
2. **`Route.recordTrip`** — checkbox no planejador; validação de exatamente 1 cliente; amostragem GPS ~2 s na navegação.
3. **`CustomerAccessPath`** — no check-in com `recordTrip`, consolida TrackingPoint origem→cliente; um ACTIVE por cliente (novo supersede).
4. **`CustomerLandmark`** — porteira/ponte/bifurcação/estrada ruim no GPS atual; alerta de proximidade ≤120 m.
5. **Rotas futuras** — 1 cliente com path ACTIVE: geometria gravada no lugar do OSRM; landmarks no payload de campo e no `/map`.
6. **v0.15.3 — não perder a trilha:** fila GPS + snapshot no check-in; persistência 5 m/2 s se `recordTrip`; LineString mínima; retry no check-out; unique 1 ACTIVE; UI de status.

## Furos fechados (v0.15.3)

- POST em voo / rede ruim descartava GPS → fila `localStorage` + lote
- Servidor amostrava 25 m/15 s mesmo com Gravar viagem → 5 m/2 s
- `catch {}` no check-in → `accessPath.saved` + audit; check-out tenta de novo
- Consolidação < 2 pontos → origem+destino sempre geram LineString
- Mapa escondia “sem trilha” → texto **Sem trilha de acesso**
- Limite que permanece: GPS nativo com tela bloqueada / PWA em background (navegador pausa)

## APIs

| Método | Path | Papéis | Notas |
| --- | --- | --- | --- |
| `POST` | `/api/v1/routes/preview-customers` | ADMIN, MANAGER, SUPERVISOR | Body `recordTrip?: boolean` |
| `POST` | `/api/v1/routes/dispatch-customers` | ADMIN, MANAGER | Persiste `recordTrip`; erro `ROUTE_RECORD_TRIP_SINGLE_CUSTOMER` |
| `POST` | `/api/v1/routes` | ADMIN, MANAGER | Aceita `recordTrip` (1 visita) |
| `GET` | `/api/v1/field/my-route` | EMPLOYEE | Inclui `recordTrip`, `accessPath`, `landmarks[]` por parada |
| `POST` | `/api/v1/customers/:id/landmarks` | ADMIN, MANAGER, EMPLOYEE* | *EMPLOYEE só em rota IN_PROGRESS com `recordTrip`; payload inclui `createdBy` |
| `DELETE` | `/api/v1/customers/:id/landmarks/:landmarkId` | ADMIN, MANAGER, EMPLOYEE* | mesmas regras do POST; 404 se outro cliente/tenant |
| `GET` | `/api/v1/customers/:id/access` | ADMIN, MANAGER | Path ACTIVE + landmarks (`createdBy`) |
| `POST` | `/api/v1/visits/:id/check-in` | EMPLOYEE | Body `trailPoints?`; `accessPath.saved`; audit |

## Telas

| Rota | Doc |
| --- | --- |
| `/customers/new`, `/customers/[id]` | [screens/customers.md](../screens/customers.md) |
| `/routes` | [screens/routes.md](../screens/routes.md) |
| `/field/navigate` | [screens/field-navigate.md](../screens/field-navigate.md) |
| `/map` | [screens/map.md](../screens/map.md) |

## Aceite

- [x] Lat/Lng no formulário sincronizam com o pin
- [x] Gravar viagem com 2+ clientes → 422 `ROUTE_RECORD_TRIP_SINGLE_CUSTOMER`
- [x] Check-in com recordTrip cria/supersede CustomerAccessPath
- [x] Marcos no GPS; banner ≤120 m com OK/cooldown
- [x] Path ACTIVE usado em preview/dispatch de 1 cliente
- [x] Testes unitários de validação/auth/consolidação

## Fora de escopo

- Reconhecimento de nome de rua por manobra
- Gravar viagem com várias paradas na mesma rota
- Editor rico de marcos no admin
- App nativo

## Como validar

1. Cliente fazenda: sem CEP, Lat/Lng + pin → salvar
2. `/routes`: 1 cliente + Gravar viagem → publicar
3. Campo: Play → badge Gravando → marcar Porteira → check-in
4. Gestor: `/map` no cliente → trilha roxa + marcos; nova rota 1 cliente usa a trilha

## Docs relacionados

- [modules/routes.md](../modules/routes.md), [API.md](../API.md), [CHANGELOG.md](../CHANGELOG.md) v0.15.0
