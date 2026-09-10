# PRD UX/Funcional v0.9 — Iniciar rota (campo)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §5.2.

## Tela: Iniciar rota

### 1. Identidade

- Rota: `/field/start/[id]`
- Papéis: EMPLOYEE; rota do dia `PUBLISHED`
- Objetivo: wizard antes do Play — GPS no PC/HTTPS; em HTTP LAN inicia sem GPS (1ª parada como origem), resumo, veículo, checklist, confirmar → start API → navigate
- Arquivo: `FieldStartRoutePage.tsx`; page `app/(app)/field/start/[id]/page.tsx`

### 2. Componentes

```
section max-w-lg
├── link ← Minha rota
├── H1 + KPI paradas/tempo/km
├── stepper 1…5 (gps | summary | vehicle | checklist | confirm)
├── mini-mapa MapLibre (~200px) Dark Matter + polyline menta entre paradas + pin pessoa→carro + paradas numeradas
└── card do passo ativo
```

### 3. Informação / campos por passo

| Passo | Conteúdo |
| --- | --- |
| gps | pedido automático de GPS; em HTTP LAN o passo é **pulado** (origem = 1ª parada) |
| summary | com GPS: pin **pessoa** + mais perto→mais longe + km; em HTTP: ordem planejada |
| vehicle | pin vira **carro**; select veículos (`GET /field/vehicles?routeId=`) |
| checklist | pin carro; Km inicial * (number); Combustível * (EMPTY…FULL); Observação (max 500) |
| confirm | pin carro; resumo placa, km, combustível, 1ª parada + km |

### 4. KPI / totais

Header: N parada(s) · duração planejada · distância planejada (da rota). Sem KPI novo.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Permitir localização | auto `getCurrentPosition` no passo gps; botão se falhar + opcional getUserMedia |
| Continuar / Voltar / Revisar | troca `step` |
| ▶ Iniciar rota | `POST /routes/:id/start` body `{ vehicleId, startOdometerKm, startFuelLevel, startNotes?, latitude, longitude }` → `/field/navigate` |

### 7. Estados

| Estado | UI |
| --- | --- |
| loading | “Preparando início da rota…” |
| error sem rota | alert + voltar Minha rota |
| already_active | 422 `ROUTE_ALREADY_ACTIVE` com data da rota travada + link “Ir para Minha rota e concluir” |
| gpsError | texto vermelho no passo gps |
| invalid km | “Informe o km inicial do veículo.” |
| submitting | overlay + botão **Iniciando…** (pending desde o toque, antes do GPS); trava de reentrada |
| success | redirect navigate |

### 8. Permissões

EMPLOYEE; rota deve ser PUBLISHED e pertencer ao usuário. Sem Play se outra rota IN_PROGRESS (bloqueio em Minha rota).

### 9. Navegação

De: `/field/my-route` link Iniciar. Para: `/field/navigate` após start. Voltar: Minha rota.

### 10. Mobile / PWA

Wizard no PWA em HTTPS pede GPS. HTTP LAN: faixa **NÃO ESTÁ EM HTTPS** e o Play **não** espera GPS — origem = 1ª parada, ordem planejada. `localhost` no PC pede GPS de verdade.

### 11. Fora de escopo

Upload de foto no checklist; check-in de visita; voz.

### 12. Como testar

  1. Publicar rota com 3+ clientes → Iniciar → permitir GPS → no Resumo a 1ª linha é o cliente mais perto
  2. Confirmar Play → navigate: destino = parada 1 (mais perto); linha sai do GPS atual
  3. Celular `http://IP` → Iniciar → Resumo sem pedir Permitir → Play funciona; pin ao vivo não aparece
  4. Negar GPS no PC/HTTPS → não avança
  5. Km vazio no confirm → erro
  6. Rota já IN_PROGRESS → erro ao abrir start
