# Plano 24 — PWA mobile-first app-like

**Status:** implementado (2026-09-22)  
**Escopo:** shell + padrões UI; sem mudança de API/regras.

## Objetivo

Experiência touch-first / mobile-first / PWA-first: bottom nav, safe areas, cards em listagens, formulários e sheets adequados ao polegar.

## Entregue

- [x] Tokens touch + safe-area (`globals.css`, header, sheets)
- [x] `AppBottomNav` + `AppMoreSheet` + `nav-primary.ts`; sidebar só `md+`
- [x] `DataTable` → cards `<md`; `PageHeader` stack; toolbars das 7 listagens
- [x] `MobileActionBar` em `FormCard`
- [x] Planejador: tabs Lista/Mapa; mapa ops com altura da bottom nav
- [x] `manifest.start_url` = `/`; safe-area field alinhada a CSS vars
- [x] Docs: hub, `home-shell.md`, changelog

## Bottom nav por papel

| Papel | Barra | Mais |
|-------|--------|------|
| EMPLOYEE | Início, Agenda, Campo | (vazio se só esses) |
| SUPERVISOR+ | Início, Agenda, Mapa, Rotas | Serviços, Recursos, Admin… |

## Checklist QA

### Mobile (320–430, portrait)

- [ ] Nada sob status bar / home indicator
- [ ] Bottom nav tocável; Mais abre sheet
- [ ] Listagens em cards; sem scroll-X acidental
- [ ] Forms: CTA acima da bottom nav
- [ ] `/routes` planejador: Lista ↔ Mapa
- [ ] `/map` não fica sob a bottom nav
- [ ] Sem landscape obrigatório

### Tablet (768+)

- [ ] Sidebar lateral; sem bottom nav
- [ ] Tabelas desktop

### Desktop (1280+)

- [ ] Sidebar + planejador split
- [ ] Sem regressão de fluxos

### PWA standalone

- [ ] Instalar; abre em `/`
- [ ] EMPLOYEE chega em Campo pela bottom nav
- [ ] `(field-nav)` sem chrome de gestão

## Arquivos-chave

`apps/web/src/components/layout/*`, `ui/crud.tsx`, `ui/MobileActionBar.tsx`, `(app)/layout.tsx`, `public/manifest.webmanifest`
