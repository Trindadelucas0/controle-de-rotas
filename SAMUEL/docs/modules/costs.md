# Módulo Custos da frota

Combustível operacional (não é ERP nem cartão combustível). Fórmulas só no servidor (`cost-calc.ts`). A UI mostra `{ kind: REAL | ESTIMATED | UNAVAILABLE, value, reason? }` — `value` é `null` quando não calculável (nunca 0 falso, salvo gasto REAL sem abastecimentos no período = R$ 0).

## Modelos

- `FuelFill` + `FuelFillEvidence` — cupom (litros, R$/L, km, foto)
- `VehicleCost` tipo `FUEL` — ledger; cancelar o fill cancela o custo
- `OdometerReading` — append-only (`ROUTE_START`/`END`, `FUEL_FILL`, `ADMIN_ADJUST`)
- `Company.referenceFuelPricePerLiter`, `Company.fuelReceiptRequired`

OCR: colunas + `NoopOcrProvider` (`extractFromImage` → `null`). Sem motor.

## Regras

- `totalCost = liters × pricePerLiter` no servidor (2 casas). Cliente pode mostrar preview.
- Consumo REAL = tanque a tanque (km entre fills consecutivos / litros do fill posterior).
- Custo REAL da rota só se o intervalo [startKm, endKm] estiver coberto por um par de fills.
- Distância oficial da rota continua `actualDistanceMeters` (odômetro vs GPS).
- Estimativa: `km / avgConsumption × referencePrice`. Sem cadastro: UNAVAILABLE.
- EMPLOYEE: `POST /field/fuel-fills`; lista só os próprios; 403 em `/costs/*`.
- Soft-cancel ADMIN: some dos totais, permanece no histórico.

## Endpoints

Contratos em [API.md](../API.md) (seção Fuel / Custos).
