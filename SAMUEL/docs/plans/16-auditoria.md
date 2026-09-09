# Tema 16 — Auditoria UI

**Status:** planned (tema **posterior** — fora do caminho crítico 07–15)

Auditoria de eventos de **auth** já grava em `audit_logs` desde o tema 01 (sem tela). Este tema é a **UI** + expansão de eventos operacionais.

## Escopo planejado

- Tela `/settings/audit` para ADMIN
- Filtros: período, usuário, ação, entidade
- Evoluir gravação de eventos críticos: rota publicada, visita cancelada, OS cancelada, etc. (à medida que os módulos existirem)
- Nunca persistir senha / token em `metadata`

## Telas previstas

| Rota | Papéis | Objetivo |
| --- | --- | --- |
| `/settings/audit` | ADMIN | Consultar trilha de auditoria |

## APIs previstas

| Método | Path (proposto) | Notas |
| --- | --- | --- |
| `GET` | `/api/v1/audit-logs?from&to&userId&action&entity` | Paginação; só mesma empresa |

## Fora de escopo

- SIEM externo, export legal hold completo (pode ser fase 2)
- Chatwoot
- Não faz parte do caminho crítico OS→campo→KPI

## Critérios de aceite (quando done)

- [ ] ADMIN lista eventos da própria empresa
- [ ] MANAGER/outros: 403 (ou política documentada)
- [ ] Eventos de auth existentes visíveis
- [ ] Docs + sem vazamento de segredo no metadata

## Como validar (quando implementado)

1. Login/logout → evento aparece.
2. Após temas 07–09: cancelar OS / publicar rota → eventos novos (quando instrumentados).
