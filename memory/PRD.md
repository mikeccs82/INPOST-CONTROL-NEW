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

## Animaciones Carga mejoradas (realistas) (2026-06-05)
- CargaVehiculo.jsx rediseñado: SVG con gradientes (carrocería/cabina/cristal), sombra, faro con glow, luz trasera, ruedas con llanta+radios girando, carretera con profundidad, líneas de velocidad y humo. Zona de recogidas pulsante con cajas 3D y flecha.
- CargaOrden.jsx rediseñado: interior claro con suelo de listones, cajas pseudo-3D (cara superior/lateral, nº, cinta) cargándose de la última a la primera, caja 1 naranja con glow + "A MANO" junto a puerta trasera, zona recogidas al frente con "recogidas" minúscula vertical.
- PENDIENTE usuario: redeploy para emergent.host.

## Orden de carga: apilado por columnas (2026-06-05)
- CargaOrden.jsx: cajas apiladas en columnas de 3, de abajo hacia arriba (1,2,3 col1; 4,5,6 col2; 7... col3). count = nº paradas del driver_route (cap 12). Animación escalonada por índice. Cabina detallada (parabrisas/faro/espejo, verificada testing iteration_11). Badge/mensaje actualizados al apilado por columnas respetando recogidas.
- Driver 1122 tiene driver_route con 7 paradas (para demo del apilado).
- PENDIENTE usuario: redeploy para emergent.host.

## Orden de carga: orden real de apilado (2026-06-05)
- CargaOrden.jsx: se carga primero la ÚLTIMA parada junto a la zona de recogidas (frente/derecha), apilando hacia arriba, y avanzando columna a columna HACIA LA PUERTA. Ej 6 paradas: col recogidas 6(abajo),5,4 | col puerta 3,2,1. La parada 1 (naranja) queda del lado de la puerta. stop = n - j; col=floor(j/3) desde recogidas; delay j*0.4 (n primero). Mensaje/badge actualizados.

## Carga al furgón (lista de ingreso) (2026-06-05)
- CargaOrden: botón "Siguiente" (carga-orden-next) -> screen 'carga-lista'.
- Nuevo CargaLista.jsx (screen 'carga-lista'): junta driver_route.stops (orden reparto -> nº parada = index+1) con saca_session.positions (por stop_id -> posición, sacas, bultos, order_id). Recorre de ATRÁS hacia adelante (última->primera). Tarjeta grande por parada: Parada, Posición, ID orden, Sacas, Bultos + botón grande "Ingresado al furgón" (carga-lista-ingresado) que avanza. Barra de progreso, botón Anterior, y pantalla final "¡Furgón cargado!". Solo frontend (GET my/route-config + my/sacas).
- Verificado por captura (flujo 7 paradas driver 1122).

## Carga al furgón: lista + capacidad (2026-06-05)
- CargaLista.jsx: tarjeta actual arriba (Ingresado al furgón) + lista de ingresadas abajo con "Devolver a nave" (baja contador, vuelve a pendiente). Contador "Paradas subidas". Botón dinámico: completo -> "Siguiente"; incompleto -> "No tengo más capacidad" -> modal confirm ("dejar restantes en nave") -> saveDriverRouteOrder(solo cargadas) -> onFinish (recarga + screen 'reparto').
- DriverApp: CargaOrden onNext->'carga-lista'; CargaLista onFinish->load()+setScreen('reparto'). Nueva screen 'reparto' (Paso 4, Próximamente).
- Persistencia: la ruta final (solo cargadas) se guarda vía PUT /my/driver-route/order.
- Verificado por captura (ingresar/devolver/modal/confirm->reparto).

## Ruta a Reparto (Paso 4) (2026-06-09)
- Activado el Paso 4 (antes placeholder "Próximamente"). Nuevo `RepartoView.jsx` (screen 'reparto').
- Muestra la ruta final del conductor (driver_route.stops, solo las cargadas) en orden de reparto: tarjeta "Próxima parada" destacada + lista completa numerada.
- Cada parada tiene botón "Ir" que abre Google Maps con navegación (`maps/dir/?api=1&destination=lat,lon&travelmode=driving`; fallback a dirección si no hay coords). En móvil abre la app de Google Maps.
- DriverDashboard: card 'reparto' soon:false -> onOpenReparto -> screen 'reparto'. Solo frontend (GET /my/route-config).
- Verificado por captura (4 paradas, botones Ir renderizados).

## Reparto: flujo parada a parada entregar/recoger (2026-06-09)
- RepartoView convertido en flujo secuencial: tarjeta de parada ACTUAL con máquina de estados. Fases: viaje ("Ir con Google Maps" + "Ya estoy en el sitio") -> en sitio (botones "Entregar" y "Recoger") -> "Siguiente parada".
- Entregar: muestra cantidad de sacas y bultos a entregar (de saca_session.positions por stop_id) + botón "Entregado".
- Recoger: contador +/- para "¿cuántas sacas recoges?" + botón "Recogido (N)".
- Lista inferior con estado por parada (Hecha/Actual/pendiente). Al pulsar "Siguiente parada" avanza; al final "¡Ruta completada!".
- SOLO frontend por ahora (sin persistencia). Pendiente: el usuario comentará variaciones. Verificado por captura (Ir->en sitio->entregar 1/0->entregado->recoger 2->recogido).

## Reparto: memorizado + incidencias + horarios + lista seleccionable (2026-06-09)
- PERSISTENCIA: nueva colección `reparto_sessions` (diario por conductor+fecha). Backend GET/PUT /api/my/reparto {idx, stops:{stop_id:{delivered,deliveredSacas,deliveredBultos,pickedUp,pickupSacas,incidencia:{tipo,detalle},done}}}. Modelo RepartoBody(idx:int, stops:Dict). api.js: myReparto(), saveMyReparto(idx, stops). RepartoView carga en mount y persiste en cada acción -> sobrevive recarga.
- INCIDENCIA EN SITIO: al pulsar "Ya estoy en el sitio", entre "Entregar/Recoger" (arriba) y "Siguiente parada" (abajo) hay botón "Incidencia" -> modal con 2 opciones: (1) "Cerrado, vuelvo más tarde" (marca vuelvo y avanza, parada NO hecha, badge VUELVO); (2) "Cerrado definitivo" -> pide detalle en textarea -> guarda y avanza (badge Cerrado).
- INCIDENCIA AL TERMINAR: si se hizo entrega o recogida, "Siguiente parada" abre modal "¿Hubo alguna incidencia?" -> No (continúa) / Sí (caja de detalle -> guardar y continuar).
- HORARIOS: cada tarjeta (actual y lista) muestra la ventana horaria (window_from - window_to) entre el nombre y la dirección con icono reloj.
- LISTA SELECCIONABLE: cada parada de la lista es pulsable; al seleccionarla despliega su botón "Ir con Google Maps". Badges por estado (Actual/Hecha/Vuelvo/Cerrado).
- Verificado: curl (GET/PUT persiste) + captura (flujo completo entregar/recoger, modal incidencia sí->detalle, recarga mantiene 3/3, lista Ir).

## Historial por día en Ordenar ruta, Carga y Reparto (2026-06-09)
- Extendida la lógica "por día" (como Ordenar Sacas) a los 3 pasos restantes. Barra de fecha (DayBar.jsx) arriba con selector de días anteriores; días pasados en SOLO LECTURA (no modificables).
- Backend: nuevas/actualizadas colecciones por día. `route_day_sessions` (driver_route por driver+fecha). GET /my/route-config, /my/carga, /my/reparto aceptan ?date= y devuelven {date, today, editable, dates}. `_driver_days()` une fechas de saca/route/carga/reparto. build y driver-route/order escriben en route_day_sessions[hoy] (+ route_config para compat). PUT carga/reparto siguen escribiendo solo en hoy.
- Frontend: DriverApp (Ordenar ruta) + CargaLista + RepartoView usan DayBar y cargan por fecha; en solo lectura se ocultan/inhabilitan reordenar, ingresar/devolver, y las acciones de reparto (Ir/Ya estoy/entregar/recoger).
- Datos de prueba sembrados (scripts/seed_past_days.py) para el conductor 1122: 2 días anteriores que salieron a ruta — 2026-09-03 (completo) y 2026-09-04 (con incidencias: vuelvo, cerrado definitivo, y una entrega con problema).
- Verificado por curl (editable/dates por fecha) y capturas (los 3 pasos en día pasado, solo lectura).

## Ruta compartida por varios conductores (opción A) (2026-06-09)
- route_configs ahora admite `driver_ids` (lista) además de `driver_id` (legacy). Helper _mine(user) busca la ruta por driver_id OR driver_ids. 8 lookups "my route" migrados.
- create/update_route_config: valida cada conductor (rol driver, no asignado a otra ruta) y guarda driver_ids (+ driver_id=primero para compat). _enrich_config devuelve `drivers` (lista) y `driver` (primero). list_route_configs junta ids de driver_ids.
- Progreso independiente: sacas/route/carga/reparto ya están keyed por driver_id, así que cada conductor tiene su avance. Fallback de driver_route en route_config solo se usa si len(driver_ids)<=1 (evita fuga entre conductores).
- Frontend RouteConfigPanel: RouteForm con multiselección de conductores (checkboxes), takenIds = todos los driver_ids, Card muestra lista de conductores. Verificado API (2 conductores misma ruta, progreso separado) + UI.
- Alta de usuarios (UsersDialog): checkbox "Es administrador". Backend UserCreate.is_admin -> role "admin"|"driver". Al marcarlo se ocultan datos de furgón. GET /users ahora devuelve todos (drivers+admins); RouteConfigPanel filtra role!=='admin' para el desplegable de conductores. update/delete_user por id (protegido: no se puede borrar el ADMIN_USERNAME principal). Verificado: crear admin/driver, login del nuevo admin, listar usuarios.
- Ubicación GPS: al pulsar "Ya estoy en el sitio" (tarjeta actual o lista) se captura navigator.geolocation y se envía a POST /api/my/location -> colección `driver_locations` {driver_id, driver_username, date, stop_id, stop_name, route_number, lat, lon, accuracy, created_at}. Solo en día editable. Verificado por curl (registro guardado).
- App reiniciada a cero: solo queda el admin principal (5708699). seed_data.json vaciado para que producción también arranque limpia; seed inicial idempotente por bandera seed_flags.
- Foto de etiqueta enderezada (CCW) y mejorada (contraste/nitidez); guardada en /app/frontend/public/saca-ejemplo.jpg.
- Dibujados 2 recuadros rojos con etiquetas: "RUTA" junto a Zona de reparto (8014) y "PARADA ID" junto a los últimos 4 dígitos del Identificador de punto (4346).
- SacasSort: pantalla de entrada (estado `intro`) al abrir la sección: muestra la imagen + 2 instrucciones + botón "Siguiente" (data-testid sacas-intro-next) que lleva a la pantalla de ordenar sacas. Imagen servida como /saca-ejemplo.jpg?v=3.
- Verificado por captura (intro -> Siguiente -> pantalla de búsqueda).
- CargaLista ahora carga también myReparto(date) y calcula deliveredIds (paradas con progress.delivered en reparto).
- En la lista "Ingresadas al furgón": si una parada ya está ENTREGADA en Reparto, muestra la etiqueta verde "Entregada al destinatario" y NO permite "Devolver a nave" (botón oculto). Las no entregadas mantienen "Devolver a nave" (en días editables).
- Verificado por captura (día 2026-09-04: paradas 1 y 4 entregadas -> etiqueta; sin devolver).
- Lista "Todas las paradas": al seleccionar una parada aparecen 2 botones: "Ir con Google Maps" y "Ya estoy en el sitio" (este último hace esa parada la actual y entra en modo en-sitio).
- FIX reporte usuario ("al volver a una parada no me deja entregar/recoger"): los botones Entregar/Recoger ya NO se deshabilitan cuando están hechos; muestran "Entregado ✓" / "Recogido ✓ (N)" pero siguen pulsables para corregir/re-registrar. La causa del reporte era estado previo (parada ya servida) que bloqueaba los botones.
- Verificado por captura.
- BUG usuario: "no se está memorizando la carga del vehículo". El set `loaded` de CargaLista vivía solo en estado local; al recargar/volver se perdía el progreso.
- FIX: nueva colección independiente `carga_sessions` (diario por conductor+fecha) para registrar qué paradas ya se ingresaron al furgón.
  - Backend: GET /api/my/carga (devuelve {date, loaded_stop_ids} del día) y PUT /api/my/carga (upsert por driver_id+date con loaded_stop_ids, route_config_id, route_number, updated_at). Modelo CargaBody.
  - Frontend api.js: myCarga(), saveMyCarga(ids). CargaLista carga myCarga en el mount y restaura el set (filtrando ids que sigan en la ruta). ingresar()/devolver() persisten el set al backend en cada cambio.
  - Al generar nueva ruta NO se borra la carga (se mantiene lo marcado, decisión del usuario).
- Verificado: curl (PUT/GET persiste) + captura móvil (progreso restaurado 1/4 con la parada ya ingresada tras reentrar en Paso 3).
