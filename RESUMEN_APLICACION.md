# RUTAOPT — Optimizador de Rutas de Reparto (Resumen detallado)

> Aplicación logística full-stack para planificar, optimizar y ejecutar rutas de reparto
> a partir de datos de Excel, con roles de **Administrador** y **Conductor**.
> Direcciones principalmente en España. Idioma de la aplicación: **Español**.

---

## 1. ¿Qué es la aplicación?

RUTAOPT es una herramienta de gestión de rutas de última milla (estilo InPost/BoxLogic) que:

- Importa paradas desde archivos **Excel** (formato real del cliente).
- **Optimiza el orden** de reparto con OR-Tools (VRPTW: respeta ventanas horarias).
- Muestra las rutas sobre un **mapa OpenStreetMap** (Leaflet).
- Permite al **administrador** configurar rutas, asignar conductores por día y monitorizar el avance en vivo.
- Guía al **conductor** paso a paso desde el móvil: ordenar sacas, ordenar ruta, cargar el vehículo y hacer el reparto con navegación por Google Maps.

---

## 2. Roles y acceso

Login **numérico** (usuario y contraseña son números) con JWT.

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| **Master Admin** | Supervisor. Configura todo y monitoriza. | Panel de administración |
| **Conductor (Driver)** | Reparte en la calle. | App móvil de 4 pasos |

**Regla de acceso del conductor:** un conductor **solo** puede operar un día si el admin lo ha
asignado a una ruta para **esa fecha** en el módulo **"Asignación de Ruta"**. Los días anteriores
se ven en **solo lectura**.

### Credenciales de prueba (entorno preview)
- **Master Admin:** `5708699` / `16288959`
- **Conductor real importado:** `1111` / `1111` (Mike Stelluti, Ruta 8002 con 36 paradas)

---

## 3. Flujo del ADMINISTRADOR

Panel principal con tarjetas:

### 3.1 Configuración de rutas
- Define cada ruta: número, delegación, activa, hora de carga, muelle y hora de salida.
- **Sube paradas por Excel** (reemplaza las paradas de la ruta).
- **Importar Excel de todas las rutas**: un único Excel con columna `Ruta` reparte las paradas a cada ruta por número.
- El parser es **robusto e independiente del orden de columnas**: detecta por nombre y coincidencia parcial (dirección, lat/lon, `Title`→ID de pedido, `Notes`→nombre del destinatario, ventanas horarias, tipo de parada, `Ruta`). Admite coordenadas con coma decimal (41,376588).
- **Nota:** la asignación de conductor ya NO se hace aquí, sino en "Asignación de Ruta".

### 3.2 Asignación de Ruta (antes "Diario Ruta")
- Tabla por día con cada línea de ruta: Ruta, Conductor, Teléfono, Hora de carga, Muelle.
- Asignar/cambiar conductor por ruta (desplegable).
- **Cargar todas las rutas**, **Añadir ruta**, **Repetir** (duplicar línea para otro conductor), **Eliminar**.
- **Reiniciar** (botón ámbar por ruta): borra TODO el avance del conductor de ese día
  (Ordenar Sacas, Ordenar Ruta, Carga, Reparto, ubicaciones y notificaciones) **sin** tocar
  la asignación ni las paradas de la ruta.
- Selector de fecha para ver días anteriores (solo lectura).

### 3.3 Estado rutas (monitor en vivo)
- Tabla con el avance en tiempo real de cada ruta del día:
  estado actual, sacas ordenadas, paradas confirmadas, paradas realizadas, % entregadas,
  última entrega y última interacción.
- Estados: Sin asignar / Sin empezar / Ordenando sacas / Ruta ordenada / Cargando vehículo / En reparto / Finalizado.
- Auto-refresco cada 20 s ("En vivo").

### 3.4 Notificaciones (conductor → supervisor)
- Globo rojo con contador de no leídas (poll cada 20 s).
- Tipos:
  - **Parada no registrada:** el conductor tiene una saca que no está en su ruta. El admin puede
    **Corregir** → registrar la parada nueva (geocodifica la dirección y la añade a la ruta).
  - **Sobrante de carga (no entró):** paradas que no cupieron en el furgón. El admin decide:
    **En nave** (se arrastran al día siguiente como primeras y bloqueadas) o **Otra ruta**
    (quedan disponibles para el 2.º conductor de la misma ruta).

### 3.5 Delegaciones y naves
- Alta/edición/borrado de delegaciones (Barcelona, Madrid, …) y la **dirección de la nave**
  (punto de salida y retorno de las rutas de esa delegación). Se **geocodifica** automáticamente.
- No se puede borrar una delegación usada por rutas.

### 3.6 Conductores
- Alta/edición de usuarios (conductores y admins). Campo **delegaciones obligatorio**.
- Datos de furgón (capacidad, cierre de seguridad), teléfono, y enlace para **compartir accesos por WhatsApp**.

### 3.7 Simulación de ruta
- Herramienta de planificación libre: importar Excel o elegir una ruta, editar paradas,
  optimizar por tiempo/distancia, ver KPIs y el mapa, guardar/exportar.

---

## 4. Flujo del CONDUCTOR (móvil, 4 pasos)

Dashboard con tarjetas de Paso 1 a Paso 4 + "Datos de la ruta" y "Paradas de la ruta".
Todo funciona **por día** (barra de fecha; días pasados en solo lectura).

### Paso 1 — Ordenar Sacas
- Pantalla de introducción con foto de etiqueta de ejemplo (marca la RUTA y la PARADA ID).
- El conductor dice (voz, `es-ES`) o escribe los **últimos 4 dígitos** del ID de pedido.
- La app asigna una **posición de montón** por orden de procesado y pregunta **Saca/Bulto**.
- Correcciones con botones −/+ para sacas y bultos, y eliminar posición (renumera).
- Si un número no coincide con ninguna parada → **Aislar**; puede notificar al supervisor ("Es de mi ruta").

### Paso 2 — Ordenar Ruta
- **Optimiza** solo las paradas que "salieron" (ordenadas en Sacas), partiendo de la **nave** de la delegación (con retorno).
- Muestra en la lista las filas **SALIDA · NAVE** (verde) y **RETORNO · NAVE** (azul) y en el mapa.
- **Elegir 1.ª parada** (opcional): ancla una parada al inicio.
- **Repetir último día:** copia las sacas del último día laborable y optimiza.
- **Reordenar manual:** botones **▲/▼** en cada parada (funcionan en móvil y desktop) + arrastrar-y-soltar en desktop. Persiste al instante.
- Las paradas **"Pendiente ayer"** (arrastre obligatorio) salen primeras y quedan **bloqueadas**.
- Respeta ventanas horarias (VRPTW) y minutos de servicio por tipo de parada.

### Paso 3 — Carga del vehículo
- **Animaciones SVG** realistas: furgoneta con zona de recogidas reservada al frente y orden de apilado
  (se carga primero la última parada, la parada 1 queda "A MANO" junto a la puerta).
- **Checklist de carga** parada a parada ("Ingresado al furgón" / "Devolver a nave"), con progreso.
- Si no hay capacidad: **"No tengo más capacidad"** → confirma → las no cargadas quedan como
  **solo recogida** y se **notifica el sobrante** al admin.
- La carga se **memoriza** por día (sobrevive a recargas).

### Paso 4 — Ruta a Reparto
- Flujo secuencial parada a parada con máquina de estados:
  **Ir con Google Maps** → **Ya estoy en el sitio** → **Entregar** / **Recoger** → **Siguiente parada**.
- **Entregar:** muestra sacas/bultos a entregar. **Recoger:** contador +/− de sacas recogidas.
- **Incidencias:** "Cerrado, vuelvo más tarde" o "Cerrado definitivo" (con detalle); también incidencia al terminar la parada.
- Muestra **ventanas horarias** por parada; lista seleccionable con estado (Hecha/Actual/Vuelvo/Cerrado).
- **GPS silencioso:** al llegar a una parada se guarda la ubicación en segundo plano (para el admin), sin avisos.
- Todo se **persiste** por día en `reparto_sessions`.

### Extras del conductor
- **Datos de la ruta** (próximamente) y **Paradas de la ruta** (solo lectura + comentario por parada).

---

## 5. Control de sobrantes de carga (Fases 1–4)

1. **Fase 1:** el conductor puede elegir su 1.ª parada; las paradas que no escaneó pueden marcarse como "solo recogida".
2. **Fase 2:** al cerrar la carga, las paradas que no entraron generan una **notificación de sobrante** al admin.
3. **Fase 3:** el admin decide **En nave** o **Otra ruta** (reversible).
4. **Fase 4:** lo que queda "en nave" se **arrastra al día siguiente** como paradas primeras y bloqueadas ("Pendiente ayer"); si se entregan, la notificación se auto-resuelve.

---

## 6. Arquitectura técnica

```
/app/
├── backend/                 FastAPI + Motor (MongoDB async)
│   ├── server.py            TODOS los endpoints, modelos y optimizador (~2.300 líneas)
│   ├── requirements.txt
│   └── .env                 MONGO_URL, DB_NAME
└── frontend/                React 19 + TailwindCSS + Shadcn UI
    ├── src/
    │   ├── AppRoot.jsx       Router (admin → AdminApp, driver → DriverApp)
    │   ├── App.js            Simulación de ruta (herramienta admin)
    │   ├── lib/api.js        Cliente axios (todas las llamadas /api)
    │   └── components/
    │       ├── AdminApp.jsx, AdminDashboard.jsx
    │       ├── RouteConfigPanel.jsx, DiarioRuta.jsx (Asignación de Ruta)
    │       ├── EstadoRutas.jsx, Notificaciones.jsx, DelegacionesPanel.jsx
    │       ├── DriverApp.jsx, DriverDashboard.jsx
    │       ├── SacasSort.jsx, StopList.jsx, MapView.jsx
    │       ├── CargaVehiculo.jsx, CargaOrden.jsx, CargaLista.jsx
    │       ├── RepartoView.jsx, PreCargaModal.jsx, DayBar.jsx
    │       └── UsersDialog.jsx, LoginScreen.jsx
    └── .env                 REACT_APP_BACKEND_URL
```

### Stack
- **Frontend:** React 19, TailwindCSS, Shadcn/UI, react-leaflet (mapa OSM), `@hello-pangea/dnd` (reordenar), `sonner` (toasts), framer-motion. Tema oscuro "tactical logistics", acento naranja `#F26A21`.
- **Backend:** FastAPI, Motor (MongoDB), **OR-Tools** (optimización VRPTW), geocodificación Nominatim/Photon y OSRM público para matriz/geometría.
- **Todas las rutas del backend van prefijadas con `/api`.**

---

## 7. Modelo de datos (colecciones MongoDB)

| Colección | Contenido |
|-----------|-----------|
| `users` | Usuarios (rol admin/driver, login numérico, delegaciones, datos de furgón, teléfono) |
| `route_configs` | Rutas: número, delegación, paradas[], hora carga, muelle, activa |
| `route_journal` | **Asignación de Ruta** por fecha (línea = ruta + conductor + fecha) |
| `delegaciones` | Delegación + dirección/coords de la nave |
| `notifications` | Alertas conductor→admin (parada no registrada, sobrante de carga) |
| `settings` | Configuración global (nave por defecto, minutos por tipo, hora de salida) |
| `saca_day_sessions` | Sacas ordenadas por conductor+fecha (Paso 1) |
| `route_day_sessions` | Ruta optimizada del conductor por fecha (Paso 2) |
| `carga_sessions` | Paradas ingresadas al furgón por fecha (Paso 3) |
| `reparto_sessions` | Progreso de entregas/recogidas/incidencias por fecha (Paso 4) |
| `driver_locations` | Puntos GPS capturados durante el reparto |
| `routes` | Rutas guardadas de la herramienta de Simulación |

**Tipos de parada:** `P` (Particular), `PD` (PUDO), `L` (Locker), `L24` (Locker 24h) — cada uno con minutos de servicio.

---

## 8. Endpoints clave del backend (`/api`)

**Auth y usuarios**
- `POST /auth/login`, `GET /users`, `POST /users`, `PUT /users/{id}`, `DELETE /users/{id}`

**Rutas y asignación**
- `GET/POST/PUT/DELETE /route-configs`, `POST /route-configs/{id}/stops` (Excel), `POST /route-configs/import-all`
- `GET/POST/PUT/DELETE /route-journal`, `POST /route-journal/{eid}/duplicate`, `POST /route-journal/{eid}/reset`, `POST /route-journal/load-all`
- `GET /route-status` (monitor en vivo)

**Delegaciones**
- `GET /delegaciones`, `POST /delegaciones`, `PUT /delegaciones/{id}`, `DELETE /delegaciones/{id}`

**Conductor (por día, resueltos vía Asignación de Ruta)**
- `GET /my/sacas`, `PUT /my/sacas`, `POST /my/sacas/repeat-last`
- `GET /my/route-config`, `POST /my/route/build`, `PUT /my/driver-route/order`, `PUT /my/route/comment`
- `GET /my/carga`, `PUT /my/carga`
- `GET /my/reparto`, `PUT /my/reparto`
- `POST /my/location`
- `POST /my/notifications`, `POST /my/notifications/sobrante`

**Notificaciones (admin)**
- `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/mark-read`,
  `PUT /notifications/{id}/resolve`, `PUT /notifications/{id}/decision`, `POST /route-configs/{cid}/add-stop`

**Optimización / geocodificación**
- `POST /optimize`, `POST /compute-route`, búsqueda de direcciones (Nominatim).

---

## 9. Integraciones externas
- **OR-Tools** (optimización de rutas, local en el backend).
- **OpenStreetMap** — Nominatim/Photon (geocodificación) y OSRM público (matriz de distancias y geometría de ruta).
- **Google Maps** — navegación turn-by-turn desde el móvil del conductor (enlace `maps/dir`).
- **WhatsApp** — compartir accesos del conductor (enlace `wa.me`).
- *(Sin claves de API necesarias para las anteriores.)*

---

## 10. Estado actual
- Flujos de Admin y Conductor completos y verificados (Pasos 1–4, control de sobrantes Fases 1–4).
- Datos reales de producción importados al entorno preview para pruebas.
- Últimas mejoras: reordenar en móvil con botones ▲/▼, panel de Delegaciones en el Admin y botón "Reiniciar día" por ruta en Asignación de Ruta.

### Backlog (próximo)
- **Sobrantes por ruta** en "Estado rutas".
- **Coordenadas manuales** al registrar una parada aislada (si falla la geocodificación).
- **Más tipos de incidencia** (dirección errónea, entrega con problema).
- **Diario de reparto** para el admin (resumen diario de entregas/recogidas/incidencias del Paso 4).

---

_Documento generado como resumen técnico-funcional de la aplicación. Fecha: 2026-09-06._
