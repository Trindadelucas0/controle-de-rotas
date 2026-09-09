---
name: Rotas
description: Console operacional de campo — dispatch, rotas e visitas.
colors:
  canvas: "#121212"
  surface: "#1C1C1E"
  surface-2: "#242426"
  ink: "#F2F2F4"
  muted: "#9A9AA0"
  accent: "#FF5722"
  accent-hover: "#E64A19"
  danger: "#E5484D"
  warn: "#F5A524"
  ok: "#3DDC84"
  route: "#2EE6C7"
typography:
  sans:
    fontFamily: "Overpass, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Overpass, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
---

# DESIGN.md — Rotas (SAMUEL)

Identidade visual **v0.16.0**, derivada do código em `apps/web`.

## Overview

Console operacional B2B. Um canvas escuro para gestor e campo. A interação é laranja. A rota no mapa é menta. Nada mais usa menta.

## Colors

| Papel | Valor |
| --- | --- |
| Canvas | `#121212` |
| Surface | `#1C1C1E` |
| Ink | `#F2F2F4` |
| Muted | `#9A9AA0` |
| Accent / CTA | `#FF5722` |
| Danger | `#E5484D` |
| Warn | `#F5A524` |
| Ok (estado) | `#3DDC84` |
| Route polyline only | `#2EE6C7` |

Presence online usa ponto verde semântico (`emerald-500`), distinto da menta da rota e do laranja de interação.

## Typography

Overpass 400–700 em toda a UI. Sem serif. Labels de campo em 11px uppercase muted.

## Layout

Densidade operacional. Home: atenção → execução → faixa de KPIs → listas. Formulários em seções (`FormSection` + `FieldGrid`). Uma ação primária por vista. Sidebar agrupada: Operação / Recursos / Administração.

## Elevation & Depth

Bordas de baixa opacidade. Sem sombra de card. Sem glass. Sem gradiente.

## Shapes

Radius 4 / 6 / 8 / 10 px. Não usar `rounded-xl` como costume de template.

## Components

- `.ops-btn-primary` — única ação principal (laranja)
- `.ops-btn-secondary` — alternativa
- `.ops-btn-ghost` — baixo peso
- `.ops-btn-danger` — irreversível
- `.ops-input` / `.ops-label` / `.ops-tabs` / `.ops-surface`
- Basemap: CARTO `dark_all`. Polyline `#2EE6C7` com glow.

## Do's and Don'ts

- Do: KPI ausente = `—`. Encerrar ≠ Concluir. Presence ≠ Operational.
- Don't: menta em botão/tab/badge. Não inventar KPI. Não usar roxo, musgo, serif, glass.
