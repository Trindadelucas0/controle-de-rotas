# Segurança — Rotas

## Princípios

- Nunca confiar no cliente.
- Autenticação e autorização no backend.
- Segredos apenas em variáveis de ambiente.
- Tokens de sessão em cookies **httpOnly** (não em `localStorage`).

## Auth (Tema 01)

| Item | Decisão |
| --- | --- |
| Senha | bcrypt com `BCRYPT_ROUNDS` (≥10) |
| Access JWT | cookie `access_token`, TTL `JWT_ACCESS_TTL` |
| Refresh | cookie `refresh_token` opaco, hash SHA-256 no banco, rotação no refresh |
| Cookies | httpOnly, SameSite=Lax, Path=/, Secure se `COOKIE_SECURE=true` |
| Rate limit | Redis por IP+email (login) e por IP (forgot) |
| RBAC | roles ADMIN / MANAGER / SUPERVISOR / EMPLOYEE — guards no Nest |

## CORS

Origem única configurável: `CORS_ORIGIN` (dev: `http://localhost:3000`). Sem `*`.

## MFA

**Não implementado** neste tema. Documentado como pendência futura.

## Audit

Eventos: `USER_LOGIN`, `USER_LOGOUT`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `PASSWORD_CHANGED`. Metadata sem senha.

## Checklist rápido

- [x] Secrets fora do código / `.env.example` sem valores de produção reais
- [x] Sem `NEXT_PUBLIC_` de secret (JWT, DB, etc.)
- [x] `NEXT_PUBLIC_CARTO_BASEMAPS_KEY` é chave **pública de cota** de tiles (visível no Network); não é secret de servidor — valor real só em `.env.local`, nunca no git
- [x] Cookies httpOnly
- [x] Validação de input no backend (class-validator)
- [x] Rate limit em endpoints sensíveis
- [ ] MFA
- [ ] RLS Postgres (planejado com evolução multi-tenant)
