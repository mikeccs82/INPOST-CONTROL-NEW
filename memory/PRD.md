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

## Ordenar Sacas (Paso 1 del conductor) (2026-06-05)
- Botón "Ordenar Sacas" del dashboard del conductor ya activo (screen 'sacas' -> SacasSort.jsx).
- El conductor dice (voz, Web Speech API es-ES) o escribe los últimos 4 dígitos del ID de orden. Se extraen dígitos y se toman los últimos 4.
- Lógica: si el nº ya tiene posición -> "Posición X" (añade al mismo montón); si coincide con una parada nueva -> asigna siguiente posición incremental y pregunta Saca/Bulto; si no coincide con ninguna parada -> "Parada no reconocida" -> botón Aislar (lista aparte).
- Las posiciones se crean en el ORDEN en que el conductor procesa (no el orden de ruta). Muestra resumen: Posición N -> parada -> sacas/bultos, + aisladas.
- Busca contra las paradas del route_config asignado al conductor (admin). NOTA: no todas las paradas salen cada día; esto identifica cuáles "salieron".
- Backend: GET /api/my/sacas (devuelve stops del route_config del driver + session), PUT /api/my/sacas (guarda saca_session={positions,isolated} en el route_config). Modelos SacaPosition/SacaIsolated/SacaSessionBody. api.js: mySacas, saveMySacas.
- Probado: backend curl (GET/PUT/persist) + screenshots móvil (new/existing/unknown/persist). Voz no testeable por screenshot pero usa misma ruta lógica.
- PENDIENTE (usuario lo definirá): usar las paradas "que salieron" (con posición) en el Paso 2 "Ordenar ruta" para optimizar solo ese subconjunto. Storage ya listo.

## Fix móvil cabecera Simulación + aclaraciones (2026-06-05)
- BUG: en 'Simulación de ruta' (App.js) la cabecera blanca con muchos botones se desbordaba en móvil y 'Salir' (logout-btn) quedaba fuera de pantalla (right~602>390). FIX: grupo derecho de botones ahora 'flex flex-wrap justify-end w-full md:w-auto' -> envuelve en filas; logout-btn dentro del viewport (right=378). Verificado testing agent iteration_8 (12/12, 0 bugs).
- Aclaración usuario 1111: su contraseña es 1111 (no 2002). Login OK con 1111/1111.
- 'No sale el dashboard admin' en móvil: en PREVIEW sí sale (probable versión DESPLEGADA antigua -> el usuario debe redeploy para ver el dashboard nuevo).

## Health check despliegue + optimización (2026-06-05)
- deployment_agent: status WARN, SIN bloqueadores. Env vars OK, sin secretos/URLs hardcodeadas, /api prefijado, CORS OK, compila OK, supervisor OK, seed idempotente.
- Único WARN: N+1 en GET /api/route-configs -> OPTIMIZADO (batch $in de driver_ids + _enrich_config(doc, users_map)). Verificado testing agent iteration_9 (28/28 backend, sin regresión).
- App lista para desplegar. Nota: to_list(1000) limita listas a 1000 (suficiente a escala actual).

## Ajustes visuales Ordenar Sacas (2026-06-05)
- Tarjeta de resultado: "Posición N" MUCHO más grande (text-5xl), y bajo el nombre del establecimiento se muestra la DIRECCIÓN de entrega (obtenida de las paradas por last4).
- Lista de ubicados: los 4 dígitos en grande (text-3xl) + dirección debajo + nombre en pequeño + contadores saca/bulto.
- addrOf(last4) busca la dirección en los stops del route_config.
- Estado BD preview: solo queda conductor 1122/1122 (mike); Ruta 8010 reasignada a 1122 (36 paradas). Los demás conductores fueron borrados.
- PENDIENTE usuario: redeploy para que estos cambios lleguen a emergent.host.

## Integración Sacas -> Ordenar ruta (Paso 1 -> Paso 2) (2026-06-05)
- Botón "Siguiente paso" (sacas-next-step, arriba dcha en Ordenar Sacas) llama POST /api/my/route/build: optimiza SOLO las paradas registradas en Sacas (saca_session) desde la NAVE (settings.start), guarda route_config.driver_route {stops ordenadas, start, end, round_trip, departure_time, summary} y navega a "Ordenar ruta".
- DriverApp reescrito: usa GET /api/my/route-config (NO más assignments por fecha). Eliminado selector de fecha. Pantalla route: spinner mientras carga -> si driver_route null muestra prompt "Aún no has preparado la ruta" (go-sacas-btn) -> si existe muestra mapa (nave S/E) + lista reordenable. Reorden persiste con PUT /api/my/driver-route/order.
- PUT /api/my/route/comment ahora escribe en route_config.stops (no assignments). Paradas de la ruta usa todas las stops del route_config.
- Nave de prueba en settings: Nave Central 41.3350/2.1300, same_as_start, 08:00.
- Legacy sin usar (candidatos a limpiar): /api/my/route (assignments), /api/my/dates, /api/my/route/order.
- Probado: testing agent iteration_10 (5/5 backend, 100% frontend, 0 bugs) + capturas. Mejora aplicada: spinner para evitar parpadeo del estado vacío.
- PENDIENTE usuario: redeploy para que llegue a emergent.host.

## Nave por defecto + Siguiente a Carga (2026-06-05)
- Nave por defecto: Carrer de les Oliveres, 1, 08800 Vilanova i la Geltrú, Barcelona (lat 41.2462526, lon 1.722634). Configurada en el modelo Settings (default start) y en la BD. departure_time por defecto 08:00.
- "Ordenar ruta" (Paso 2): botón "Siguiente" (route-next-step, arriba dcha) -> pantalla "Carga del vehículo" (Paso 3, screen 'carga', placeholder Próximamente). Dashboard card 'carga' también abre esta pantalla.
- Probado por captura + curl (build optimiza desde Vilanova).
- PENDIENTE usuario: redeploy para emergent.host.

## Animación Carga del vehículo (2026-06-05)
- Nuevo CargaVehiculo.jsx (screen 'carga'): furgoneta SVG animada (drive-in, ruedas girando, rebote, carretera en movimiento) con zona verde parpadeante + flecha en la parte delantera lateral etiquetada "Zona de recogidas". Mensaje: dejar espacio en la parte delantera lateral para las recogidas. Animaciones CSS keyframes inline.
- PENDIENTE usuario: redeploy para emergent.host.

## Orden de carga (2026-06-05)
- CargaVehiculo: botón "Siguiente" (carga-next-step) -> screen 'carga-orden'.
- Nuevo CargaOrden.jsx (screen 'carga-orden'): animación de cajas que se cargan de la ÚLTIMA parada (n) a la PRIMERA (1), con la parada 1 "A MANO" junto a la puerta trasera y la zona de recogidas reservada al frente. count = nº paradas del driver_route (cap 6). Mensaje explicativo.
- PENDIENTE usuario: redeploy para emergent.host.
