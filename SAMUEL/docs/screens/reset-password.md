# PRD UX/Funcional v0.9 — Redefinir senha

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §2.3.

## Tela: Redefinir senha

### 1. Identidade

- Rota: `/reset-password?token=...`
- Papéis: público com token
- Objetivo: definir nova senha via token de reset
- Arquivos: `apps/web/src/app/(auth)/reset-password/page.tsx`, `ResetPasswordForm.tsx`

### 2. Componentes

```
AuthCard
└── ResetPasswordForm
    ├── sem token → FormError “Link inválido…” + Voltar
    ├── success → alerta + CTA Ir para o login
    └── form: PasswordField Nova senha + Confirmar + Submit Redefinir
```

### 3. Informação

| Campo | Tipo | Validação | Erro |
| --- | --- | --- | --- |
| Nova senha | password | min 8 | “Mínimo 8 caracteres.” |
| Confirmar senha | password | igual | “As senhas não coincidem.” |

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Redefinir senha | `POST /api/v1/auth/reset-password` `{ token, password, passwordConfirmation }` |
| Ir para o login / Voltar | `/login` |

### 7. Estados

| Estado | UI |
| --- | --- |
| invalid (sem token) | erro sem chamar API |
| idle / loading / error | form padrão |
| success | “Senha alterada. Faça login.” + CTA |
| empty / forbidden | N/A |

### 8. Permissões

Público. Token válido no backend; reuso/expiração → mensagem da API.

### 9. Navegação

- De: URL do log da API após forgot-password
- Query: `token` (obrigatório para o form)
- Para: `/login`

### 10. Mobile / PWA

Card max ~400px; autocomplete `new-password`.

### 11. Fora de escopo desta tela

Force logout UI (sessões revogadas no backend); e-mail transacional.

### 12. Como testar

1. Token do log → troca → login.
2. Token reusado → erro API.
3. Sem token → invalid sem API.
4. Senhas diferentes → erro client.
