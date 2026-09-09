# Plano 06b — Cliente CNPJ / CEP / pin

**Status:** done (2026-08-24)

## Entrega

- API `lookups` (BrasilAPI CNPJ/CEP + Nominatim address) com cache Redis
- Formulário de cliente: sem lat/lng digitáveis; clique/arraste no mini-mapa; CEP/rua/CNPJ puxam pin
- Salvar exige pin

## Telas

| Rota | Status |
| --- | --- |
| `/customers/new` | done (UX pin) |
| `/customers/[id]` | done (UX pin) |

## Docs

- `docs/modules/lookups.md`
- `docs/screens/customers.md`
- `docs/API.md` + CHANGELOG v0.3.2
