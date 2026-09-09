# Plano 06 — Mapa (PostGIS + MapLibre)

**Status:** done (2026-08-24)

## Stack

- PostGIS no Docker (`postgis/postgis:16-3.5`, porta 5433)
- MapLibre GL JS + estilo raster OpenStreetMap
- Nominatim para geocode
- Sem Mapbox/Google/Leaflet

## Telas

| Rota | Status |
| --- | --- |
| `/map` | done |

## API

- `GET /api/v1/map/customers`
- `GET /api/v1/map/customers/nearby`
- `POST /api/v1/customers/:id/geocode`
