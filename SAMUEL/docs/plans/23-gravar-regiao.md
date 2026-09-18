# Tema 23 — Missão Gravar região (ponto + raio)

**Status:** done (2026-09-17, software **v0.19.0**).

**Dependências:** Gravar cliente (22), planejador `/routes`, campo Play/record-point/complete.

## Escopo entregue

1. Gestor marca **centro + raio** no mapa (aba **Região**) e publica (`POST /routes/dispatch-region-mission`).
2. Origem da rota = centro clicado (não pin da empresa). Raio padrão 5000 m (500–50000).
3. Campo lê a região (nome + km) **antes do Play**; círculo no mini-mapa e na navegação.
4. Gravar ponto = missão Gravar cliente. Fora do raio: aviso, não bloqueia.
5. Clientes no círculo no planejador são só informativos. Não grava `employees.region`.

## Inventário de telas

| Tela | Arquivo | Papel |
| --- | --- | --- |
| `/routes` aba Região | `RoutesPlannerRegionMission.tsx` | ADMIN/MANAGER publicam; SUPERVISOR sem Publicar |
| `/routes` Rotas de hoje / Gerir | `RoutesTodayView.tsx`, `RouteManagePanel.tsx` | leitura da área |
| `/field/my-route` | `FieldMyRoutePage.tsx` | EMPLOYEE |
| `/field/start/:id` | `FieldStartRoutePage.tsx` | EMPLOYEE |
| `/field/navigate` | `FieldNavigatePage.tsx` | EMPLOYEE |

## Fora de escopo

Polígono municipal, geofence permanente, bloquear ponto fora do raio, auto-rota com clientes do círculo, gravar `employees.region`.
