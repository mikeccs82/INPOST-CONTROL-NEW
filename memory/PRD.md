# PRD — RUTAOPT (Optimizador de rutas con OpenStreetMap)

## Problema original
"Construyeme un optimizador de ruta con OpenStreetMap en base a información que daré en un Excel; que la aplicación permita visualizar el mapa, editar el orden, meter paradas una a una (por latitud/longitud o buscando por nombre y número de calle), guardar y exportar." Direcciones principalmente en España.

## Decisiones de usuario
- Optimización: depósito fijo con vuelta al inicio; opción "más rápido" (tiempo) y "más corto" (distancia).
- Geocodificación: Nominatim (gratis).
- Guardar rutas + exportar.
- Sin autenticación. Colores: paleta profesional de logística (no se aportó logo).

## Arquitectura
- Frontend: React + Leaflet/react-leaflet (mapa OSM con filtro oscuro), @hello-pangea/dnd (reordenar), sonner (toasts), framer-motion. Tema oscuro "tactical logistics", acento naranja #FF6B00.
- Backend: FastAPI. Nominatim para geocodificar; OSRM público para matriz (/table) y geometría (/route). Optimización TSP: nearest-neighbor + 2-opt + or-opt, con depósito fijo y evaluación cruzada de ambas métricas.
- MongoDB: colección `routes` (rutas guardadas).

## Implementado (2026-06)
- Importar Excel (columnas en español) → parseo + geocodificación de filas sin coordenadas.
- Añadir parada por búsqueda de dirección (autocompletado Nominatim) o por lat/lon manual.
- Mapa con marcadores numerados, depósito distintivo (D) y polilínea de ruta real.
- Editar orden por drag-and-drop, fijar depósito, eliminar parada (recalcula ruta).
- Optimizar por tiempo o distancia, ida y vuelta on/off. KPIs de paradas/distancia/tiempo.
- Guardar, listar, cargar y eliminar rutas. Exportar a Excel (.xlsx).
- Probado: 24/24 tests backend, flujos frontend OK. Optimizador corregido (fastest ya no peor que shortest).

## Backlog (P1/P2)
- P1: Import de archivos grandes sin coordenadas como job en segundo plano con progreso.
- P2: Or-opt con delta-cost para >150 paradas; ventanas horarias como restricción real; múltiples vehículos.
- P2: Recolorear con el logo real de la empresa cuando se aporte.

## APIs externas (sin claves)
- Nominatim (geocoding), OSRM public server (routing/matrix).
