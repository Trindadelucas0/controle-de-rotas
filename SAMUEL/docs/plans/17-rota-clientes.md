# Tema 17 — Rota por clientes, login de campo e navegação GPS

**Status:** done (2026-08-25)

**Dependências:** clientes com pin (06b), OS/visitas (07–08), rotas por visitas (09), Play + tracking HTTP (10–11).

## Escopo entregue

1. **Login obrigatório no cadastro do funcionário** — `POST /employees` exige e-mail + senha; cria `User` papel `EMPLOYEE` e vincula `employee.userId` na mesma transação. Edição: “Criar acesso” se ainda não tiver login; sem campo UUID cru.
2. **Planner `/routes` modo Clientes (padrão)** — multi-seleção de clientes ACTIVE com pin + funcionários ACTIVE com `userId`; mapa com N linhas; publicar cria OS+visitas+rotas `PUBLISHED`. Modo secundário “Visitas agendadas” permanece.
3. **API preview/dispatch por clientes** — `POST /routes/preview-customers` (sem persistir) e `POST /routes/dispatch-customers` (transação com veículos AVAILABLE e `planned_steps_json`).
4. **Navegação GPS pós-Play** — `/field/my-route` inicia e redireciona para `/field/navigate` (tela cheia, MapLibre escuro, manobras, HUD tempo/km/ETA).

Domínio mantido: `Cliente → OS → Visita → Parada → Rota → Funcionário + Veículo`.

## APIs

| Método | Path | Papéis | Notas |
| --- | --- | --- | --- |
| `POST` | `/api/v1/routes/preview-customers` | ADMIN, MANAGER, SUPERVISOR | Split + OSRM; rate limit Redis 30/min |
| `POST` | `/api/v1/routes/dispatch-customers` | ADMIN, MANAGER | Publica N rotas; OS título `Rota {data}` |
| `POST` | `/api/v1/employees` | ADMIN, MANAGER | Body: `email` + `password` (mín. 8) obrigatórios |
| `PATCH` | `/api/v1/employees/:id` | ADMIN, MANAGER | `password` opcional cria acesso se sem `userId` |
| `GET` | `/api/v1/field/my-route` | EMPLOYEE | Inclui `plannedStepsJson` |
| `POST` | `/api/v1/routes/:id/start` | EMPLOYEE | Play → depois UI redireciona para navigate |

Erros relevantes (422 salvo onde indicado): `CUSTOMER_NO_PIN`, `EMPLOYEE_LOGIN_REQUIRED`, `ROUTE_NOT_ENOUGH_VEHICLES`, `ROUTE_EMPLOYEE_BUSY`, `ROUTE_DUPLICATE_CUSTOMERS`, `ROUTE_DUPLICATE_EMPLOYEES`, `ROUTE_TOO_MANY_STOPS`, `ROUTE_TOO_MANY_EMPLOYEES`, `ROUTE_CUSTOMER_NOT_FOUND`, `EMPLOYEE_NOT_ACTIVE`, `COMPANY_ORIGIN_MISSING`; create login: `USER_EMAIL_EXISTS` (409), `EMPLOYEE_ALREADY_HAS_LOGIN`, `EMPLOYEE_LOGIN_EMAIL_REQUIRED`.

## Telas

| Rota | Doc | Objetivo |
| --- | --- | --- |
| `/routes` | [screens/routes.md](../screens/routes.md) | Modo Clientes + Visitas |
| `/employees`, `/employees/new`, `/employees/[id]` | [screens/employees.md](../screens/employees.md) | Login no cadastro / criar acesso |
| `/field/my-route` | [screens/field-my-route.md](../screens/field-my-route.md) | Capa: Play → navigate |
| `/field/navigate` | [screens/field-navigate.md](../screens/field-navigate.md) | Navegação GPS fullscreen |

## Aceite

- [x] `/employees/new` com e-mail + senha → login EMPLOYEE em `/login`
- [x] Funcionário sem `userId` não aparece no despacho por clientes; API retorna `EMPLOYEE_LOGIN_REQUIRED`
- [x] 4 clientes com pin + 2 funcionários com login + 2 veículos AVAILABLE → publica 2 rotas balanceadas
- [x] Cliente sem pin → `CUSTOMER_NO_PIN`
- [x] Play → `/field/navigate` com mapa, linha, seta, manobra, tempo/km/ETA
- [x] Arrastar mapa sai do follow; bússola volta a seguir
- [x] GPS continua em `POST /tracking/points`; gestor vê em `/map`
- [x] `userId` permanece nullable no banco (legado sem login ok, só não despacha)

## Fora de escopo

- Vários endereços por cliente
- VRP comercial, capacidade, janelas de horário
- Pin de casa do funcionário
- Play pelo gestor
- Check-in/fotos (temas 12–13)
- Forçar `userId` NOT NULL em funcionários antigos
- Voz/TTS, trânsito ao vivo além do OSRM, faixas/limites oficiais
- Recálculo OSRM em tempo real fora da rota (MVP segue geometry planejada)

## Como validar

1. Criar funcionário com e-mail + senha → login no `/login`
2. Em `/routes` (Clientes), selecionar clientes com pin e só funcionários “Com login”
3. Preview → Publicar rotas
4. Login do funcionário → Play → navegação fullscreen
5. Gestor em `/map` vê o pin do veículo

## Docs relacionados

- [modules/routes.md](../modules/routes.md), [modules/employees.md](../modules/employees.md), [modules/tracking.md](../modules/tracking.md)
- [API.md](../API.md), [CHANGELOG.md](../CHANGELOG.md) v0.7.0
