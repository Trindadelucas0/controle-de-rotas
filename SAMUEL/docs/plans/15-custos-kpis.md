# Tema 15 — Custos e KPIs financeiros

**Status:** done (primeira entrega — combustível)

**Fase:** evolução operacional. Não inclui receita, margem, OCR motor, UI de manutenção/pedágio.

## Escopo entregue (0.20.0)

- Abastecimentos reais (`FuelFill` + ledger `VehicleCost` FUEL)
- Histórico de odômetro (`OdometerReading`)
- Motor `cost-calc.ts`: REAL / ESTIMATED / UNAVAILABLE
- Dashboard `/costs`, ficha do veículo, card na rota
- PWA `/field/fuel-new`
- Preço de referência e comprovante obrigatório na Empresa
- Alertas no dashboard (`CONSUMPTION_VARIANCE`, `COST_PER_KM_UP`, `MISSING_RECEIPT`, `ODOMETER_INCONSISTENT`)
- OCR só gancho (stub)

## Telas

| Rota | Papéis | Objetivo |
| --- | --- | --- |
| `/fuel` | ADMIN, MANAGER, SUPERVISOR | Lista/form de abastecimentos |
| `/costs` | ADMIN, MANAGER, SUPERVISOR | KPIs REAL vs ESTIMADO |
| `/field/fuel-new` | EMPLOYEE | Registro simples |
| `/settings/company` | ADMIN | Preço ref + exigir comprovante |

## APIs

| Método | Path | Notas |
| --- | --- | --- |
| `GET/PATCH` | `/api/v1/companies/me/cost-settings` | Preço/L de referência (ESTIMATIVA) + flag comprovante |
| `GET` | `/api/v1/costs/dashboard?from&to` | Agregados com `kind` |
| CRUD | `/api/v1/fuel-fills` | Multipart; total no servidor |
| `POST` | `/api/v1/field/fuel-fills` | EMPLOYEE |

## Fora de escopo (ainda)

- Cartão combustível / ERP
- OCR de cupom
- UI de tipos além de combustível
- Rentabilidade / receita

## Critérios de aceite

- [x] Cálculos auditáveis em `cost-calc.ts` + testes
- [x] Sem custo inventado quando falta KM / par de fills — ESTIMADO ou NÃO CALCULÁVEL
- [x] Secrets de OCR futuros só no backend (stub local)

## Como validar

Roteiro **17** em `docs/GUIA-TESTES.md`.
