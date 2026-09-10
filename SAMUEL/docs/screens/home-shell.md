# PRD UX/Funcional v0.9 — Chrome (shell)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §1.

## Tela: Chrome compartilhado (não é rota)

### 1. Identidade

- Rotas cobertas: autenticadas **exceto** `/field/navigate`
- Papéis: conforme item da sidebar
- Objetivo: navegação Operação · Recursos · Administração + sessão
- Arquivos: `(app)/layout.tsx`, `AppHeader.tsx`, `AppNav.tsx`, `UserMenu.tsx`

### 2. Componentes

```
aside desktop (lg+): Rotas + empresa + AppSidebarNav
drawer mobile (☰)
AppHeader: marca | UserMenu (nome, role, Alterar senha, Sair)
main: full-bleed em `/` e `/map`; senão max-w-5xl
```

### 3. Informação

Grupos: **Operação** (Início, Mapa, Agenda, Serviços, Rotas, Campo) · **Recursos** (Clientes, Funcionários, Veículos) · **Administração** (Empresa, Usuários). Labels e papéis: ver PRD UX §1.

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

Navegar · Alterar senha → `/account/change-password` · Sair → logout + `/login`.

### 7. Estados

loading sessão (skeleton header + main) | idle | sem sessão (redirect api-client).

### 8. Permissões

Middleware só cookie. Item some da nav se `roles` não inclui o papel. API 403 se URL direta.

### 9. Navegação

Campo `/field/navigate` usa layout `(field-nav)` sem este chrome.

### 10. Mobile / PWA

Drawer + ☰ `aria-label="Abrir menu"`. Overlay fecha o menu.

### 11. Fora de escopo

Top-nav horizontal (removida; `AppNav` legado só no mobile antigo).

### 12. Como testar

1. ADMIN: três grupos visíveis.
2. EMPLOYEE: Início, Agenda, Campo; sem Clientes/Mapa/Serviços/Rotas/Empresa.
3. SUPERVISOR: Mapa/Agenda/Serviços/Rotas/Clientes; sem Funcionários/Veículos/Admin.
4. `/` e `/map` sem padding `max-w-5xl`.

---

Nota histórica: esta ficha substitui o “home legado” (atalhos pré-v0.10.0). Home atual: [home.md](home.md).
