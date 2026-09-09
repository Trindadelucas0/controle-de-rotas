# Tema 19 — PWA de campo + início de rota guiado

**Status:** done (2026-08-28)

**Dependências:** tema 17 (navegação GPS), tema 18 (várias rotas no dia).

## Escopo entregue

1. **PWA instalável** — `manifest.webmanifest` com `start_url: /field/my-route`; trava `FieldPwaLocationGate` (não é mais banner dispensável). SW mínimo (`public/sw.js`) para o Chrome oferecer instalar. iOS: Compartilhar → Adicionar à Tela de Início.
2. **Wizard de início** — `/field/start/[id]` substitui Play direto: permissões GPS (obrigatório) → resumo → veículo → checklist (km, combustível, observação) → confirmar com lat/lng.
3. **API estendida** — `POST /routes/:id/start` aceita body com veículo, checklist e GPS inicial; `GET /field/vehicles?routeId=` lista veículos `AVAILABLE` + veículo já atribuído à rota.
4. **Prisma** — campos em `Route`: `startOdometerKm`, `startFuelLevel`, `startNotes`, `startLatitude`, `startLongitude`.
5. **Navegação melhorada** — primeiro fix GPS centraliza mapa (fitBounds + easeTo); botão Centralizar sempre visível; confirmação ao sair (`beforeunload`, `popstate`, modal Encerrar); `wakeLock` best-effort enquanto navega.

## APIs

| Método | Path | Papéis | Notas |
| --- | --- | --- | --- |
| `GET` | `/api/v1/field/vehicles?routeId=` | EMPLOYEE | Veículos `AVAILABLE` + atribuído à rota |
| `POST` | `/api/v1/routes/:id/start` | EMPLOYEE atribuído | Body: `vehicleId`, `startOdometerKm`, `startFuelLevel`, `latitude`, `longitude`, `startNotes?` |

## Telas

| Rota | Doc |
| --- | --- |
| `/field/*` (trava) | [screens/field-pwa-gate.md](../screens/field-pwa-gate.md) |
| `/field/my-route` | [screens/field-my-route.md](../screens/field-my-route.md) |
| `/field/start/[id]` | [screens/field-start-route.md](../screens/field-start-route.md) |
| `/field/navigate` | [screens/field-navigate.md](../screens/field-navigate.md) |

## Aceite

- [x] Trava instalar PWA em `/field/*` (Android/iOS); GPS pedido na abertura do app
- [x] Iniciar rota abre wizard; GPS obrigatório; câmera/microfone opcionais
- [x] Funcionário escolhe veículo disponível (ou mantém o atribuído)
- [x] Checklist km/combustível gravado no start; mapa abre centralizado
- [x] Sair da navegação pede confirmação; rota permanece `IN_PROGRESS`
- [x] Concluir em Minha rota libera próxima rota

## Fora de escopo (MVP)

- Foto obrigatória / câmera no checklist
- Recálculo OSRM em tempo real
- GPS em background com app fechado
- Travamento forte da navegação (impossível Encerrar)
- Cache offline (SW atual só habilita “Instalar app” no Chrome)
- WebSocket push de nova rota

## Docs relacionados

- [modules/tracking.md](../modules/tracking.md), [API.md](../API.md), [CHANGELOG.md](../CHANGELOG.md)
