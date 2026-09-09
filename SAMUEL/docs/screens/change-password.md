# PRD UX/Funcional v0.9 — Alterar senha

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §2.4.

## Tela: Alterar senha

### 1. Identidade

- Rota: `/account/change-password`
- Papéis: qualquer autenticado
- Objetivo: trocar senha com confirmação da atual; revoga sessões
- Arquivos: `apps/web/src/app/(app)/account/change-password/page.tsx`, `ChangePasswordForm.tsx`

### 2. Componentes

```
(chrome AppHeader/AppNav — ver home-shell.md)
└── ChangePasswordForm (max-w-md)
    ├── PasswordField Senha atual
    ├── PasswordField Nova senha
    ├── PasswordField Confirmar nova senha
    ├── FormError
    └── SubmitButton Alterar senha
```

### 3. Informação

| Campo | Validação | Erro |
| --- | --- | --- |
| Senha atual | required | “Informe a senha atual.” |
| Nova senha | min 8; ≠ atual | “Mínimo 8 caracteres.” / “A nova senha deve ser diferente da atual.” |
| Confirmar | igual à nova | “As senhas não coincidem.” |

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Alterar senha | `PATCH /api/v1/auth/change-password` → `/login?changed=1` |

### 7. Estados

| Estado | UI |
| --- | --- |
| idle / loading / invalid / error | form |
| success | redirect forçado ao login |
| empty / forbidden | N/A (autenticado) |

### 8. Permissões

Qualquer autenticado. Sem sessão → middleware login.

### 9. Navegação

- De: UserMenu “Alterar senha”; card na home
- Para: `/login?changed=1` (API revoga sessões)

### 10. Mobile / PWA

Form `max-w-md`; PasswordField com aria show/hide.

### 11. Fora de escopo desta tela

Política de complexidade além de min 8; MFA.

### 12. Como testar

1. Logado → alterar → banner no login → entrar com nova senha.
2. Nova igual à atual → erro client.
3. Senha atual errada → erro API.
