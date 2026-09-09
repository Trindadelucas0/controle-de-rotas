# Tema 15 — Custos e KPIs financeiros

**Status:** planned

**Fase:** pós-ciclo crítico 07–14. Não bloqueia MVP operacional OS→Visita→Rota→Campo.

## Escopo planejado

- Custo estimado por KM (parâmetro da empresa / veículo)
- Custo por visita / por rota / por funcionário (agregações)
- Combustível: estimado primeiro; real (lançamento manual ou integração) depois
- Ligação aos totais de distância planejada/real (temas 09 e 11)

## Telas previstas

| Rota | Papéis | Objetivo |
| --- | --- | --- |
| `/dashboard` (seção custos) ou `/settings/costs` | ADMIN, MANAGER | Parâmetros + leitura de KPIs $ |

## APIs previstas

| Método | Path (proposto) | Notas |
| --- | --- | --- |
| `GET/PATCH` | `/api/v1/companies/me/cost-settings` | R$/km, etc. |
| `GET` | `/api/v1/dashboard/costs?from&to` | Agregados |

## Fora de escopo

- Cartão combustível / ERP
- Chatwoot
- Precificação comercial de cliente

## Critérios de aceite (quando done)

- [ ] Cálculos auditáveis (fórmula documentada)
- [ ] Sem custo inventado quando falta KM real — mostrar estimado vs indisponível
- [ ] Secrets de integrações futuras só no backend

## Como validar (quando implementado)

1. Configurar R$/km → rota com KM known → custo bate fórmula.
2. Sem actual KM → UI não finge precisão.
