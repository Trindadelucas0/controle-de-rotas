# Módulo — Mapa

Mapa operacional do Rotas: **MapLibre GL JS** + tiles raster **CARTO Voyager** (`NEXT_PUBLIC_CARTO_BASEMAPS_KEY`) + **PostGIS** (Docker). Attribution: © OpenStreetMap © CARTO.

## Endpoints

### GET /api/v1/map/customers

- Auth: ADMIN, MANAGER, SUPERVISOR
- Query: `q`, `status`
- Resposta: `{ customers: [{ id, name, latitude, longitude, locationStatus, status, city, street, number }] }`

### GET /api/v1/map/customers/nearby

- Query: `lat`, `lng`, `radiusMeters` (default 3000)
- SQL: `ST_DWithin` em `customers.location`

### POST /api/v1/customers/:id/geocode

- Auth: ADMIN, MANAGER
- Nominatim → lat/lng → trigger preenche `location`

## UI `/map` (live)

- Poll `GET /tracking/live` a cada **3 s**
- Clique no pin do veículo: `GET /routes/:id` → lista de paradas + **Ver no mapa** (pinta `plannedGeometryJson` OSRM)
- Query `?employeeId=` foca o funcionário e auto-pinta se ao vivo

## Banco

- Extensão `postgis`
- Coluna `location geometry(Point,4326)` + índice GIST
- Trigger sync a partir de latitude/longitude
