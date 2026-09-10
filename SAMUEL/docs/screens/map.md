# PRD UX/Funcional — Mapa (v0.14 centro de comando)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §3.2.

## Tela: Mapa operacional (hub)

### 1. Identidade

- Rota: `/map` (`?employeeId=` foca e abre detalhe; `?routeId=` pinta plano + trilha GPS congelada)
- Papéis: ADMIN, MANAGER, SUPERVISOR
- Objetivo: centro de comando — camadas + trilho direito (equipe / detalhe)
- Arquivo: `OperationalMap.tsx`

### 2. Componentes

```
toolbar: Busca, Status, Data, Equipe, Filtrar, camadas [Clientes|Equipe|Rotas|Todos], Ao vivo N
corpo: mapa MapLibre + trilho ~300px (desktop)
mobile: mapa + abas Equipe | Detalhe; ☰ Equipe (drawer)
```

**Camadas visuais** (não filtros de negócio novos):

| Camada | Mostra |
| --- | --- |
| Clientes | pins `GET /map/customers` |
| Equipe | carros `GET /tracking/live` |
| Rotas | LineString planejada (menta) + trilha GPS `GET /tracking/history` (âmbar) ao pintar rota |
| Todos | as três |

### 3. Trilho / detalhe funcionário

Só campos existentes: nome; Status operacional; Presença (Online/Offline); Rota atual (status traduzido); Veículo (placa ou —); Parada atual (`currentCustomerName`); Próxima parada (1ª PENDING ou —); Último GPS; lista de paradas; **Ver rota** / **Ver funcionário** (ADMIN/MANAGER).

### 4. Detalhe cliente

`GET /ops/customers/:id`: nome, prioridade, status, cidade/UF; categoria **—** (não vem no context); visita nextVisitAt; OS abertas (contagem, sem # inventado); ações da API (Abrir cliente / OS / Adicionar à rota). `GET /customers/:id/access`: bloco Acesso à fazenda no trilho mesmo sem trilha (**Sem trilha de acesso**); marcos no mapa via `LandmarkMapMarker` (ícone por tipo). Ao **Ver rota** / pintar rota do veículo, carrega `/access` dos clientes das paradas e desenha os mesmos ícones sem clicar no pin.

### 5. KPI

Resumo compacto no trilho (total, em rota, parado, offline, available se >0, inService, onlineLive, visitas, rotas).

### 6. Estados / permissões / poll

Iguais à v0.9: loading pins, empty seleção, live fail silencioso, poll 3s / snapshot 15s. Live `presence: stale` (>30 s sem update) deixa o carro mais apagado. Criar OS só ADMIN/MANAGER (PLATFORM_ADMIN herda). Tema claro usa basemap Voyager.

### 7. Fora de escopo

WebSocket; pintar N rotas do dia de uma vez (listagem sem geometry); inventar #OS no pin; editor rico de marcos.

### 8. Como testar

1. Camada Clientes → só pins; Equipe → só carros; Rotas → aviso até selecionar; Todos → tudo.
2. Clique funcionário → trilho com Presence ≠ Operational.
3. Clique cliente → trilho com ações; bloco **Acesso à fazenda** sempre (trilha gravada ou **Sem trilha de acesso**) + marcos; linha menta tracejada se ACTIVE; marcos no mapa = **ícones** (não abreviação Por/Bif).
4. Pintar rota de um veículo → ícones de marcos dos clientes das paradas aparecem junto da linha.
5. `/map?employeeId=` foca e abre detalhe.
