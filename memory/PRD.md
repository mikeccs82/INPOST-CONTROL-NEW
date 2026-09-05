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

## Dashboard del Conductor (2026-06-04)
- Nuevo `DriverDashboard.jsx`: primera pantalla tras login del conductor. Rejilla 2 columnas con 5 tarjetas grandes (Ordenar Sacas, Ordenar ruta, Carga del vehículo, Ruta a Reparto, Datos de la ruta) + botón grande rojo "Cerrar sesión" abajo a todo el ancho.
- `DriverApp.jsx`: estado `screen` ('dashboard' | 'route'). "Ordenar ruta" abre la vista mapa/lista existente; header muestra botón "← Volver" al dashboard.
- MOCKED "Próximamente" (toast): Ordenar Sacas, Carga del vehículo, Ruta a Reparto, Datos de la ruta.
- Probado con screenshot (móvil 430px): dashboard, navegación a ruta y vuelta, toasts OK.

## Paradas de la ruta (2026-06-04)
- Botón "Paradas de la ruta" (sin paso) ahora abre vista informativa `RouteStopsView.jsx` (screen 'paradas' en DriverApp).
- Muestra por parada: nº de orden, nombre, dirección, ventana horaria, notas del admin.
- Solo lectura + el conductor puede añadir/editar un COMENTARIO por parada (persiste).
- Backend: PUT /api/my/route/comment {stop_id, comment} -> guarda stops.$.driver_comment en la asignación de HOY. api.js: saveStopComment().
- Botones con pasos: Ordenar Sacas (Paso 1), Ordenar ruta (Paso 2), Carga vehículo (Paso 3), Ruta a Reparto (Paso 4). Sin paso: Datos de la ruta, Paradas de la ruta.
- Probado end-to-end (backend curl + screenshot móvil): guardado y persistencia OK.

## Panel de Administración + Configuración de rutas (2026-06-05)
- AppRoot: admin -> AdminApp (nuevo shell con dashboard), driver -> DriverApp.
- AdminDashboard: 4 tarjetas grandes -> Configuración de rutas, Estado rutas (PRÓXIMAMENTE/mock toast), Conductores (abre UsersDialog), Simulación de ruta (herramienta App.js original con botón sim-back-btn para volver).
- Configuración de rutas (RouteConfigPanel): tarjetas horizontales por ruta (Ruta {number} · conductor · nº paradas · carga · muelle · fecha actualización). Botón abajo "Agregar nueva ruta".
  - Detalle editable (número, conductor, hora carga, muelle nº, hora salida) + "Ver paradas", "Actualizar paradas" (sube Excel, reemplaza paradas), Eliminar ruta.
  - REGLA DE ORO: 1 ruta por conductor (backend 409 + dropdown marca "— ya tiene ruta" y deshabilita).
- Backend: colección route_configs. Endpoints GET/POST/PUT/DELETE /api/route-configs, GET /api/route-configs/{id}, POST /api/route-configs/{id}/stops (Excel). Helper _parse_stops_from_df reutilizado por import-excel. Paradas se guardan SIN optimizar; se geocodifican automáticamente las que no traen coords (mejor candidato).
- Probado: 91/91 backend pytest (18 nuevos), 100% flujos frontend (testing agent iteration_6). Sin bugs bloqueantes.
- Pendiente de hablar con el usuario: cómo ve el conductor su ruta desde route_configs (hoy el conductor sigue leyendo la colección `assignments` por fecha; NO está enlazado aún con route_configs).
