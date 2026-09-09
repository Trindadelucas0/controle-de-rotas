# PRD UX/Funcional v0.9 — Trava PWA + GPS

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §5.0.

## Tela: Trava PWA + GPS (overlay)

### 1. Identidade

- Rota: overlay em `/field/my-route`, `/field/start/[id]`, `/field/tracking-status`, `/field/navigate` (não é rota própria)
- Papéis: EMPLOYEE (qualquer `/field/*`)
- Objetivo: em HTTPS, impedir campo no navegador em aba e pedir GPS na abertura do PWA; em HTTP LAN, **não** bloquear — só avisar
- Arquivo: `FieldPwaLocationGate.tsx`, `InsecureHttpBanner.tsx`

### 2. Componentes

Dialog tela cheia (`role=dialog`, `aria-modal`, `aria-labelledby`) — título + texto + **um** CTA (sem “agora não”). Em HTTP: faixa `InsecureHttpBanner` **NÃO ESTÁ EM HTTPS** (não é dialog).

### 3. Informação

Títulos por fase: “Preparando o app de campo” · “Instale o Rotas” · “Ative a localização”. HTTP: faixa **NÃO ESTÁ EM HTTPS**. iOS: Compartilhar → Adicionar à Tela de Início. Android: Instalar aplicativo / prompt nativo.

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Instalar e usar localização | `beforeinstallprompt` nativo |
| Permitir localização agora | `getCurrentPosition` / permissão |
| (nenhum) | sem API |

### 7. Estados

| Phase | UI |
| --- | --- |
| checking | “Verificando instalação e localização…” |
| need-pwa | não está `display-mode: standalone` (só em HTTPS, fora de localhost) |
| need-location | PWA sem GPS; erro `role=alert` se negar |
| ready | libera a tela |
| HTTP LAN | entra em `ready` + faixa **NÃO ESTÁ EM HTTPS** (GPS do browser segue bloqueado) |
| localhost | não trava instalação |

### 8. Permissões

Só campo. Gestor no PC em localhost entra em `/field/*` sem trava de PWA (dev).

### 9. Navegação

Não redireciona; bloqueia children até `ready`.

### 10. Mobile / PWA

Obrigatório em **HTTPS** fora de localhost. HTTP LAN não exige PWA. SW `public/sw.js` (GET, sem cache) para o Chrome oferecer instalar.

### 11. Fora de escopo

Conceder GPS sem aviso do sistema; GPS com app fechado.

### 12. Como testar

1. Celular HTTPS em aba → Minha rota bloqueada; sem dispensar.
2. Instalar → ícone → Permitir no sistema → vê a rota.
3. Negar GPS → “Ative a localização” + Tentar de novo.
4. `http://192.168…` → entra em Minha rota com faixa **NÃO ESTÁ EM HTTPS** (GPS continua indisponível).
5. PC `localhost` → entra sem trava de instalação.
