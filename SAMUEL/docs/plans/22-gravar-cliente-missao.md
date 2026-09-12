# Tema 22 — Missão Gravar cliente (vários pontos)

**Status:** done (2026-09-12, software **v0.18.0**).

**Dependências:** Gravar viagem (21), rotas por clientes (17), uma rota `IN_PROGRESS` por vez (18), campo Play/complete.

## Escopo entregue

1. Gestor encaminha missão **sem** escolher cliente (`POST /routes/dispatch-record-mission`).
2. Campo grava GPS contínuo. Duas ações independentes:
   - **Adicionar ponto** → cliente no lat/lng atual (nome obrigatório; resto agora ou depois). GPS não para.
   - **Finalizar por completo** → fecha a sessão com 0..N pontos; **não** pede nome.
3. Cadastro incompleto: `CustomerStatus.DRAFT` + `profileIncomplete` + lápis no `/map`. EMPLOYEE dono e gestor editam.
4. Placeholder `recordSessionShell` nunca no mapa, catálogo, agenda ou Serviços.
5. **Gravar viagem** em cliente já cadastrado permanece (sem botão Adicionar ponto).

## Inventário de telas

| Tela | Arquivo | Papel |
| --- | --- | --- |
| `/routes` aba Gravar cliente | `RoutesPlannerRecordMission.tsx` | ADMIN/MANAGER |
| `/field/start/:id` | `FieldStartRoutePage.tsx` | EMPLOYEE |
| `/field/navigate` | `FieldNavigatePage.tsx` | EMPLOYEE |
| `/field/my-route` | `FieldMyRoutePage.tsx` | EMPLOYEE |
| `/map` | `OperationalMap.tsx` | gestores |

## Fora de escopo

App nativo; GPX; transformar ponto em visita com foto obrigatória nesta missão.
