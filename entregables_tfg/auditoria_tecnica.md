# Auditoría técnica del estado real de DLS · Digital Local Sites

> **Documento histórico.** Esta auditoría conserva el corte del 16 de julio de 2026 para trazabilidad. No describe por completo el estado del 23 de julio: desde entonces se incorporaron CRM 2, roles, paneles separados, comercio/canales en el backend principal, Descubre tu zona y una refactorización modular. La referencia vigente es `memoria_tfg.md`; las contradicciones resueltas se enumeran en `anexos/contradicciones_documentacion.md`.

**Corte analizado:** commit `8b123783eb2d8750aafdfa4a1e58d340ed82f6a3`, fechado el 16/07/2026.  
**Método:** inspección del repositorio completo, trazado de referencias, contraste con configuración, ejecución aislada, pruebas automatizadas y revisión visual.  
**Regla de verdad:** código y comportamiento actual; la documentación previa se trata como contexto histórico.  
**Límite de la auditoría:** no se accedió a servicios productivos, cuentas externas ni datos reales.

## Resumen ejecutivo

DLS es una aplicación web para producir y operar presencia digital de negocios locales. El runtime principal combina un frontend multipágina de HTML/CSS/JavaScript, un servidor HTTP nativo de Node.js y una API modular. El Studio permite editar, previsualizar y exportar webs; otras vistas cubren proyectos, prospección Radar, CRM, propuestas, mensajería preparada, reservas, informes, una web de cliente y operaciones Google. **[CÓDIGO]** Puntos de entrada en `index.html:1443-1462`, `server/server.mjs:5-20` y `pages/business-dashboard.html:10-13`. **[EJECUCIÓN]** Figuras 1–16.

El sistema dispone de persistencia dual: JSON atómico para desarrollo/pilotos y PostgreSQL directo para despliegue. **[CÓDIGO]** Selección de driver en `server/lib/business-store.mjs:44` y conexión en `server/lib/business-store.mjs:346-355`; escritura atómica en `server/lib/json-store.mjs:1-25`. **[CONFIGURACIÓN]** PostgreSQL en `render.yaml:18-20`.

La base funcional está ampliamente probada, pero el estado no es “todo verde”. El smoke integral pasa, la QA visual pasa y las suites backend ejecutadas pasan. El guard de arquitectura falla porque `src/app.js` ocupa 253.766 bytes frente al límite de 180.000; la prueba E2E larga del Studio provoca un cierre del objetivo del navegador en este entorno. **[PRUEBAS]** `server/scripts/test-studio-architecture.mjs:34` y `anexos/resultados_pruebas.md`.

Las integraciones no tienen el mismo grado de madurez. Google está conectado al servidor principal y respaldado por pruebas simuladas, pero no se verificó contra una cuenta real. Stripe, Resend y OpenAI aparecen en servicios de ejemplo independientes o endpoints configurables; no deben presentarse como integraciones productivas del backend principal. **[CÓDIGO]** Google en `server/api/google-api.mjs:71-212`; Stripe/Resend en `examples/commerce-api.example.mjs:6-26,902-912`; OpenAI en `examples/chatbot-api.example.mjs:37-52`.

## 1. Inventario de tecnologías detectadas

| Área | Tecnología comprobada | Estado y evidencia |
|---|---|---|
| Lenguajes | HTML5, CSS y JavaScript; módulos ES en Node y navegador | **[CÓDIGO]** `package.json:4`; scripts de `index.html:1443-1462`. |
| Runtime | Node.js `>=22.19`; auditado con `v24.13.1` | **[CONFIGURACIÓN]** `package.json:7-9`. |
| Servidor | `node:http` nativo, sin Express | **[CÓDIGO]** `server/server.mjs`. |
| Frontend | DOM nativo; arquitectura por namespace `window.LocalLiftStudio` | **[CÓDIGO]** consumo de módulos en `src/app.js:39-77`. |
| UI local | Lenis, Splitting, VanillaTilt y Atropos vendorizados | **[CONFIGURACIÓN]** `index.html:1443-1446`; `atropos` también en `package.json`. |
| Mapas | Leaflet 1.9.4 y MarkerCluster desde unpkg | **[CONFIGURACIÓN]** `pages/business-radar.html:14-15,240-241`. |
| Base de datos | JSON local y PostgreSQL mediante `pg` | **[CÓDIGO/CONFIGURACIÓN]** `server/lib/business-store.mjs:338-355`; `package.json`. |
| Pagos | SDK Stripe en backend de ejemplo separado | **[CÓDIGO]** `examples/commerce-api.example.mjs:6-26`; no importado por el servidor principal. |
| Despliegue | Docker, Render Blueprint y Worker Cloudflare opcional | **[CONFIGURACIÓN]** `Dockerfile`, `render.yaml`, `cloudflare/wrangler.demo-publisher.toml`. |
| CI | GitHub Actions para auditoría de dependencias y Dependabot semanal | **[CONFIGURACIÓN]** `.github/workflows/dependency-audit.yml`, `.github/dependabot.yml`. |
| Pruebas | Scripts Node con `assert`, smoke HTTP y automatización CDP | **[CÓDIGO]** `server/scripts/`; 34 scripts operativos/de prueba en `package.json`. |

No se detectan React, Vue, Angular, TypeScript, Express, ORM ni SDK de Supabase en el runtime. **[INFERENCIA CON EVIDENCIA]** Ausencia en `package.json` y en referencias del código; la documentación de RLS reconoce lo mismo en `docs/operaciones/SUPABASE_RLS_FASE_2.md:7-10`.

## 2. Inventario de módulos y componentes

### 2.1 Frontend principal

- **Entrada y selector de destino.** Portada, centro de producción y acceso a las áreas del producto. **[CÓDIGO]** `index.html:25-277`; flujo en `src/app.js:2467-2799`.
- **Studio.** Orquestación de formularios, estado, historial, autosave, preview, edición directa, layouts, medios, QA, publicación y exportación. **[CÓDIGO]** `src/app.js`; dependencias modulares en `src/app.js:39-77`.
- **Módulos Studio.** `core-utils`, `catalog`, `state-controller`, `layout-library`, `media-library`, `curated-stock-images`, `stock-images`, `data-client`, `validation`, `quality-control`, `renderer`, `exporter` y editor de botones. **[CONFIGURACIÓN]** carga en `index.html:1448-1460`.
- **Capa de experiencia.** Reorganiza accesos y estados visuales del Studio. **[CÓDIGO]** `src/studio-experience.js`.

### 2.2 Vistas de negocio

- **Proyectos:** inventario de negocios, estado, demo, accesos y eliminación. `pages/projects.html` + `src/business/projects.js`.
- **Portal operativo:** bandeja, inicio, acciones, leads, propuestas, mensajes, clientes, reservas, pedidos, productos, Google, informes y ajustes. `pages/business-dashboard.html` + `src/business/dashboard.js`.
- **Web del cliente:** reutiliza el renderer del Studio y conecta formularios públicos. `pages/client-site.html:28-32`; `src/business/client-site.js:43-78`.
- **Informe mensual:** métricas, embudo, fuentes, actividad y recomendaciones. `pages/monthly-report.html` + `src/business/monthly-report.js`.
- **Onboarding:** brief multipaso que entrega datos al Studio. `pages/onboarding.html` + `src/brief-experience.js`.

### 2.3 Prospección y comercio

- **Radar:** proveedor de descubrimiento, scoring, pitch, mapa, lista de oportunidades y traspaso al Studio. `pages/business-radar.html:239-245`; `src/radar/`.
- **Tienda visual en webs generadas:** catálogo embebido, carrito y llamada a endpoints configurables. `src/app.js:5118-5247`; lógica equivalente en `src/studio/exporter.js:669-769`.
- **Administración de tienda separada:** `pages/store-admin.html` apunta por defecto a `http://127.0.0.1:8795` (`pages/store-admin.html:429`).
- **Backend de comercio de ejemplo:** `examples/commerce-api.example.mjs`; no está montado por `server/server.mjs`.

### 2.4 Backend principal

El servidor importa y despacha módulos de health, stock, autenticación de cliente, reservas, Google, plantillas, propuestas, inbox, reportes, QA, imágenes de sitio, demos, eventos, contactos, descubrimiento y negocios. **[CÓDIGO]** `server/server.mjs:5-20,69-156`.

## 3. Inventario de funcionalidades confirmadas

### 3.1 Producción web

- Edición de contenido y estilo con preview compartido. **[CÓDIGO]** renderer creado en `src/app.js:219-245`; reutilizado en `src/business/client-site.js:43-78`. **[EJECUCIÓN]** Figuras 4, 5, 12 y 13.
- Historial, undo/redo, autosave y almacenamiento local. **[CÓDIGO]** servicios con `localStorage` en `src/app.js:188-215`; guardado en `src/app.js:2931-2978`.
- Importación/exportación JSON, HTML standalone y paquete ZIP de entrega. **[CÓDIGO]** `src/app.js:3080-3129,5850-6358`. **[PRUEBAS]** renderer, exporter y Studio core pasaron.
- Publicación de demos local o remota configurable, con caducidad. **[CÓDIGO]** `server/api/demo-publish-api.mjs`; Worker en `cloudflare/demo-publisher-worker.js`. **[PRUEBAS]** API y Worker pasaron.
- QA de contenido/visual y preparación de entrega. **[CÓDIGO]** `src/studio/quality-control.js`, `server/api/qa-visual-api.mjs:12-19`. **[PRUEBAS]** QA visual pasa.

### 3.2 Gestión comercial y operativa

- CRUD multi-negocio, archivado y acceso al portal. **[CÓDIGO]** `server/api/business-api.mjs:14-61`.
- Captación pública de leads, deduplicación, scoring, pipeline, acciones y timeline. **[CÓDIGO]** `server/api/contact-api.mjs:34-121`. **[PRUEBAS]** smoke y suites CRM. **[EJECUCIÓN]** Figuras 8 y 9.
- Propuestas comerciales con estados, vencimiento, conversión y exportación HTML/PDF. **[CÓDIGO]** `server/api/proposal-api.mjs`, `server/lib/proposal-export.mjs`. **[PRUEBAS]** `test:crm-proposals`. **[EJECUCIÓN]** Figura 10.
- Plantillas y composición de mensajes con enlaces WhatsApp/mailto; no implica envío automático. **[CÓDIGO]** `server/lib/message-template-renderer.mjs:110-117`. **[PRUEBAS]** `test:crm-templates`.
- Servicios, reservas, disponibilidad, bloqueos y recordatorios. **[CÓDIGO]** rutas en `server/api/booking-api.mjs:28-140`. **[PRUEBAS]** smoke. **[EJECUCIÓN]** Figura 11.
- Eventos públicos de conversión y consulta por negocio. **[CÓDIGO]** `server/api/event-api.mjs:21-42`. **[PRUEBAS]** smoke.
- Informes mensual, motivos de pérdida, forecast, SLA, dashboard comercial y calidad de datos. **[CÓDIGO]** `server/api/report-api.mjs:25-70`. **[PRUEBAS]** suites específicas. **[EJECUCIÓN]** Figuras 14 y 15.
- Bandeja comercial agregada y automatización diaria. **[CÓDIGO]** `server/api/inbox-api.mjs`, `server/lib/crm-automation.mjs`. **[PRUEBAS]** inbox y automation.

### 3.3 Radar e imágenes

- Descubrimiento mediante OpenStreetMap/Nominatim/Overpass y modo demo. **[CÓDIGO]** `src/radar/discovery-provider.js:91-104`; backend `server/api/discovery-api.mjs:76-107`. **[EJECUCIÓN]** modo demo en figura 7.
- Scoring y ordenación de oportunidades, mapa y traspaso de brief al Studio. **[CÓDIGO]** `src/radar/opportunity-score.js`, `src/radar/studio-handoff.js`. **[PRUEBAS]** traspaso Radar → Studio pasa.
- Búsqueda y selección de imágenes con Unsplash si hay clave y Wikimedia como alternativa; packs de sitio con Unsplash, Pexels y Pixabay. **[CÓDIGO]** `server/api/stock-image-api.mjs:3-4,103-113,371`; `server/api/site-image-api.mjs:848-1098`. **[PRUEBAS]** suites de imagen pasan con dobles.

## 4. Funcionalidades parciales, incompletas o condicionadas

| Funcionalidad | Evaluación |
|---|---|
| Comercio/Stripe | **Parcial.** El renderer y exportador consumen endpoints configurables, y existe un backend de ejemplo completo. El router principal no expone `/api/store/*`; el admin apunta a un proceso separado en 8795. |
| Resend | **Solo ejemplo.** Llamada dentro del backend de comercio de ejemplo (`examples/commerce-api.example.mjs:902-912`). |
| Chatbot con OpenAI | **Parcial.** El chatbot local está conectado; el remoto necesita un endpoint. La llamada OpenAI vive en `examples/chatbot-api.example.mjs`. |
| Google productivo | **Implementación conectada pero operación externa no verificada.** Hay rutas, cifrado y pruebas; faltan credenciales en el entorno auditado. |
| Publicación Cloudflare | **Implementación opcional.** Worker y pruebas existen; despliegue real no comprobado. |
| PostgreSQL productivo | **Implementación y configuración confirmadas.** No se conectó a la instancia externa ni se verificaron backup/restauración. |
| Mensajería | **Preparación, no transporte automático.** Se renderizan textos y enlaces; no hay proveedor WhatsApp Business o SMTP en el servidor principal. |
| Autorización multiusuario | **Limitada.** Hay token admin y sesión por negocio/áreas, pero no un directorio general de usuarios/roles internos. |
| Accesibilidad | **Parcial.** QA automatizada presente y aprobada; no equivale a una conformidad WCAG completa con tecnologías asistivas. |
| E2E Studio | **Inestable en este entorno.** La secuencia larga cierra el target; el recorrido corto de capturas sí carga y opera el viewport. |

## 5. Funcionalidades aparentemente no utilizadas

- `src/studio/business-defaults.js`: no tiene referencias fuera del propio archivo en el grafo de búsquedas realizado. **[INFERENCIA CON EVIDENCIA]** Candidato a módulo huérfano.
- `src/studio/radar-review.js`: no tiene referencias externas detectadas. **[INFERENCIA CON EVIDENCIA]** Candidato a módulo huérfano.
- `intro-smoke.png`: no se localizó una referencia desde HTML, CSS o JavaScript actual. **[INFERENCIA CON EVIDENCIA]** Asset aparentemente no usado.
- Dependencia `stripe`: se usa en `examples/commerce-api.example.mjs`, no en el backend principal. **[CÓDIGO]** No es “inútil”, pero tampoco acredita Stripe en el flujo desplegado por `npm start`.
- Se rastrean 1.401 archivos bajo `node_modules` de 1.644 archivos Git totales. **[CONFIGURACIÓN/GIT]** Aunque `.gitignore` excluye `node_modules`, esos archivos ya versionados permanecen en el índice; es deuda de repositorio.

La condición “no utilizada” se formula como inferencia estática. Un consumidor externo no presente en este repositorio no puede descartarse.

## 6. Arquitectura deducida

**[INFERENCIA CON EVIDENCIA SUFICIENTE]** La solución sigue una arquitectura de monolito modular ligero con frontend multipágina:

```text
Navegador
├─ Studio (index.html + módulos window.LocalLiftStudio)
├─ Radar / Proyectos / Portal / Web cliente / Informe / Brief
└─ HTML exportado autónomo
        │ fetch JSON / formularios / eventos
        ▼
Servidor Node nativo (server/server.mjs)
├─ router API por módulos
├─ autenticación, CORS, guards, rate limit y logging
├─ servicios de CRM, agenda, reportes, imágenes y Google
└─ adaptador de persistencia
        ├─ JSON atómico
        └─ PostgreSQL + JSONB

Sistemas externos opcionales
├─ Google APIs
├─ Nominatim / Overpass / Leaflet
├─ Unsplash / Wikimedia / Pexels / Pixabay
├─ Cloudflare Worker + KV para demos
└─ comercio y chatbot como servicios separados/configurables
```

No es una arquitectura de microservicios desplegada como conjunto. Los ejemplos de comercio y chatbot pueden ejecutarse como procesos separados, pero el manifiesto principal arranca un único servidor (`package.json` → `start`).

El frontend principal usa una estrategia de módulos clásicos que publican factorías en un namespace global y un orquestador grande que las consume. **[CÓDIGO]** `index.html:1448-1461`; `src/app.js:39-77`. Esta decisión permite compartir renderer/exporter sin toolchain de bundling, pero crea dependencia del orden de carga y concentra demasiada coordinación en `src/app.js`.

## 7. Principales flujos del sistema

### 7.1 Brief → Studio → preview → entrega

1. El usuario completa el brief de onboarding.
2. Los datos se entregan al Studio mediante almacenamiento/handoff.
3. El Studio normaliza el negocio y renderiza la web con el renderer compartido.
4. Los cambios se guardan localmente y opcionalmente por API.
5. La entrega puede ser HTML, JSON o ZIP, o una demo publicada.

**Evidencia:** `src/brief-experience.js`; consumo de handoff en `src/app.js:2834-2835`; renderer/exporter en `src/app.js:219-245`; exportaciones en `src/app.js:3080-3129`. **[EJECUCIÓN]** Figuras 4, 5 y 6.

### 7.2 Radar → oportunidad → Studio/CRM

1. Radar obtiene negocios de un proveedor o fixture demo.
2. Normaliza señales y calcula un score.
3. Ordena, muestra mapa/listado y genera un pitch.
4. Una oportunidad puede persistirse y convertirse en brief para Studio.

**Evidencia:** `src/radar/business-radar.js:171-320`; `server/api/discovery-api.mjs:76-107`; prueba de handoff. **[EJECUCIÓN]** Figura 7 muestra explícitamente “datos simulados”.

### 7.3 Web pública → lead/reserva/evento → CRM

1. El renderer crea formularios y endpoints públicos asociados al negocio.
2. El servidor valida consentimiento y normaliza el contacto.
3. Un lead repetido actualiza el contacto existente; una reserva valida servicio, disponibilidad y solapes.
4. Se registran actividad, siguiente acción, recordatorios y eventos.
5. Dashboard, bandeja y reportes agregan los resultados.

**Evidencia:** rutas públicas en `server/api/contact-api.mjs:35,51` y `server/api/booking-api.mjs:29,48`; smoke completo. **[EJECUCIÓN]** Las figuras 7–11 y 14 muestran resultados precargados del mismo modelo ficticio; el procesamiento completo se acredita por la prueba, no solo por la interfaz.

### 7.4 Cliente → sesión → áreas permitidas

1. El cliente envía negocio y contraseña a `/api/client/login`.
2. El servidor verifica scrypt y firma un token HMAC.
3. El navegador conserva la sesión y la envía en `X-LocalLift-Client-Token`.
4. El backend restringe negocio y áreas autorizadas.

**Evidencia:** `server/lib/client-auth.mjs:1-9,105-106,213-224,268-272`; cliente en `src/shared/api-config.js`. Este flujo no se capturó con contraseña; está confirmado por código y pruebas, no por figura.

## 8. Persistencia y modelo de datos

### 8.1 Almacenes

- **JSON:** lectura/escritura de un documento agregado, escritura temporal seguida de `rename` y backups opcionales. `server/lib/json-store.mjs:1-25`.
- **PostgreSQL:** tablas por colección con columnas de indexación y `data JSONB`; reemplazo transaccional y bloqueo asesor. `server/lib/business-store.mjs:202-215,251-304`.
- **Google:** almacén separado para estados OAuth, conexiones y snapshots; tokens cifrados. `server/lib/google-auth.mjs`.
- **Radar:** persistencia separada de leads de prospección configurable por archivo.
- **Demos:** filesystem local o Worker/KV remoto.

### 8.2 Entidades confirmadas

| Entidad | Campos funcionales principales |
|---|---|
| Negocio | id, slug, nombre, categoría, ciudad, propietario, plan, estado, marca, integraciones, ajustes, contenido, demo y fechas. |
| Contacto | negocio, tipo, identidad/contacto, fuente/UTM, estado, pérdida, prioridad/orden, etiquetas, notas, valor, privacidad, siguiente acción y score. |
| Actividad | negocio/contacto, tipo, título, nota, fuente, referencia y fecha. |
| Propuesta | contacto, paquete, importes, condiciones, vencimiento y estado. |
| Plantilla de mensaje | tipo, etiqueta, asunto y cuerpo. |
| Servicio | duración, precio, descripción y estado activo. |
| Reserva | contacto/servicio, cliente, inicio/fin, estado, notas, fuente/UTM y consentimiento. |
| Disponibilidad | día semanal, inicio, fin y activo. |
| Bloqueo | inicio, fin, motivo y activo. |
| Recordatorio | reserva, canal, mensaje y estado. |
| Evento | nombre, detalle, UTM, página, referrer, agente y fecha. |
| Auditoría | acción, entidad, metadatos y fecha. |

**[CÓDIGO]** Normalizadores y colecciones en `server/lib/business-store.mjs` y APIs asociadas. El health del fixture confirmó 1 negocio, 4 contactos, 3 actividades, 1 propuesta, 2 servicios, 2 reservas, 2 reglas de disponibilidad, 1 bloqueo, 1 recordatorio, 2 eventos y 1 entrada de auditoría. **[EJECUCIÓN]** Respuesta `/api/health` del entorno de captura.

### 8.3 Valoración

La persistencia PostgreSQL conserva flexibilidad al guardar el registro completo como JSONB y añade campos para id, negocio, slug, posición y fechas. **[INFERENCIA]** Es una migración pragmática del modelo documental, no un esquema relacional normalizado. Reduce el riesgo de concurrencia del JSON, pero mantiene validación y relaciones principalmente en la aplicación.

## 9. Inventario de integraciones externas

| Integración | Conexión real en el código | Estado auditado |
|---|---|---|
| OpenStreetMap/Nominatim/Overpass | Proveedor Radar y teselas Leaflet | Conectada; captura en demo, live no probada. |
| Leaflet/MarkerCluster | Scripts remotos en Radar | Conectada; dependencia de CDN. |
| Unsplash | Stock y packs de sitio si hay clave | Conectada; pruebas con doble, cuenta real no verificada. |
| Wikimedia Commons | Fallback de stock sin clave | Conectada. |
| Pexels/Pixabay | Packs de imágenes si hay clave | Conectada; pruebas simuladas. |
| Google Places | Snapshot y sincronización | Conectada; credencial ausente en captura. |
| Google Calendar | Free/busy, eventos y reserva | Conectada; OAuth real no probado. |
| Google Business Profile | Cuentas, ubicaciones, reseñas, rendimiento y acciones | Conectada; acceso externo no probado. |
| Google Workspace | Alta de usuarios | Conectada; acceso externo no probado. |
| WhatsApp | Enlaces `wa.me` y canal de recordatorio preparado | No es WhatsApp Business API ni envío automático. |
| Cloudflare Worker/KV | Publicación remota de demos | Opcional y probado localmente; despliegue no verificable. |
| Stripe | Backend de ejemplo + cliente configurable | Parcial, separado del servidor principal. |
| Resend | En backend de comercio de ejemplo | Solo ejemplo. |
| OpenAI Responses | Backend de chatbot de ejemplo | Solo ejemplo; modo local sí operativo. |

## 10. Mecanismos de seguridad identificados

### 10.1 Controles confirmados

- Token administrador por Bearer o `X-LocalLift-Admin-Token`, comparación en tiempo constante. **[CÓDIGO]** `server/lib/admin-auth.mjs:1,113-130`.
- En producción, ausencia de token admin provoca fallo cerrado. **[CÓDIGO]** `server/lib/admin-auth.mjs:54` y validador de despliegue.
- Contraseñas de cliente con scrypt y salt; sesiones HMAC con TTL por defecto de 14 días. **[CÓDIGO]** `server/lib/client-auth.mjs:7-9,105-106,213-224,268`.
- CORS configurable y exacto en producción. **[CÓDIGO]** `server/lib/cors.mjs`.
- Rechazo de TRACE, URL/cuerpo excesivos y JSON mutante sin `application/json`. **[CÓDIGO]** `server/lib/request-guards.mjs:4-45`.
- Límites por IP/ruta para leads, reservas, eventos, login, imágenes, demos, Google y Radar. **[CÓDIGO]** `server/lib/public-rate-limit.mjs:3-52`.
- Cabeceras CSP, `nosniff`, `SAMEORIGIN`, Referrer/Permissions Policy y HSTS en producción. **[CÓDIGO]** `server/lib/security-headers.mjs:5-14`.
- Prevención de path traversal en el servidor estático. **[CÓDIGO]** `server/server.mjs`.
- Logging JSON con request ID, redacción de claves sensibles y alertas por fallos repetidos de auth. **[CÓDIGO]** `server/lib/structured-logger.mjs:10-16,86-118,135-262`.
- Tokens OAuth cifrados con AES-256-GCM y estados OAuth de diez minutos. **[CÓDIGO]** `server/lib/google-auth.mjs:12,396-430`.
- Búsqueda automática de patrones de secretos y auditoría de dependencias. **[CONFIGURACIÓN/PRUEBAS]** `server/scripts/check-security-phase-8.mjs`; GitHub Actions.

### 10.2 Riesgos y límites

- La sesión cliente se almacena en `localStorage`; un XSS en el mismo origen podría leerla. **[CÓDIGO + INFERENCIA]** `src/shared/api-config.js`.
- CSP permite `'unsafe-inline'` para scripts y estilos (`server/lib/security-headers.mjs:27-28`), necesario para contenido exportado pero más permisivo frente a XSS.
- El rate limit está en memoria (`server/lib/public-rate-limit.mjs:3`): se reinicia con el proceso y no coordina réplicas.
- Se usa el primer `X-Forwarded-For` sin una lista de proxies confiables (`server/lib/public-rate-limit.mjs:160-164`).
- El modo desarrollo puede quedar abierto si no hay token; es deliberado, pero exige que `NODE_ENV` y validación de producción sean correctos.
- No hay roles internos completos. La separación cliente se basa en token, negocio y áreas.
- La documentación Supabase/RLS es un runbook futuro, no un control aplicado al runtime actual.
- La seguridad productiva de Cloudflare, Render, PostgreSQL y proveedores no es verificable desde archivos locales.

## 11. Pruebas, validaciones y calidad

### 11.1 Inventario

- Comprobación sintáctica de frontend, servidor, scripts, Worker y ejemplos: `npm run check`.
- Pruebas unitarias/estructurales Studio: core, estado, layouts, media, stock, datos, validación, renderer, exporter, arquitectura.
- Pruebas API: seguridad, Google, propuestas, plantillas, forecast, inbox, SLA, dashboard, atribución, calidad, imágenes y demos.
- Smoke integral con servidor temporal: `server/scripts/smoke-test-pilot.mjs`.
- QA visual/accesibilidad automatizada y prueba de la propia QA.
- Navegador CDP para una secuencia interactiva larga.
- Validación de despliegue y checklists de seguridad.

### 11.2 Resultado

**[PRUEBAS]** Sintaxis, smoke, QA visual y suites backend seleccionadas pasan. El guard de arquitectura y la prueba E2E de navegador no pasan. Detalle reproducible en `anexos/resultados_pruebas.md`.

No hay un reporte de cobertura. El número de scripts y aserciones no debe confundirse con cobertura exhaustiva. Tampoco se observaron pruebas de carga, pentest, restauración PostgreSQL real, validación con lectores de pantalla ni una campaña UX documentada.

## 12. Contradicciones entre código y documentación

1. `docs/AHORA.md:65` afirma que `src/app.js` se redujo a 156 KB; actualmente tiene 253.766 bytes y el guard falla. **[HISTÓRICA, YA NO VIGENTE]**
2. `docs/AHORA.md:98` aplaza PostgreSQL; el store PostgreSQL y Render Blueprint están implementados. **[HISTÓRICA]**
3. La memoria anterior trata base relacional y autenticación como trabajo futuro (`docs/referencia/LOCAL_LIFT_STUDIO_MEMORIA_TFG.md:1300-1306`); hoy hay PostgreSQL directo y login de cliente, aunque no roles multiusuario completos. **[HISTÓRICA/PARCIAL]**
4. La memoria anterior sitúa Google OAuth productivo como futuro (`...md:1321`); el código actual ya contiene OAuth, cifrado y APIs, pero su operación real sigue no verificada. **[HISTÓRICA RESPECTO AL CÓDIGO; NO VERIFICABLE EN PRODUCCIÓN]**
5. La memoria anterior propone añadir pruebas automatizadas (`...md:1306`); hoy existen 34 scripts y más de mil aserciones. **[HISTÓRICA]**
6. `docs/CIBERSEGURIDAD.md:3` presenta Supabase como stack; el runtime no contiene SDK ni configuración activa y el propio documento lo admite en `:75-76`. **[SOLO DOCUMENTACIÓN/PLAN]**
7. `docs/AHORA.md:19` dice que el flujo principal fue verificado en navegador real; la prueba actual reproduce un crash del target. Puede haber sido cierto en otro corte, pero no es repetible ahora. **[HISTÓRICA/CONTRADICCIÓN DE ESTADO]**
8. La suite `test:studio` no invoca `test:studio-browser`, aunque algunos textos de aceptación agrupan el navegador entre verificaciones obligatorias. **[CÓDIGO]** script de `package.json`.

Registro ampliado en `anexos/contradicciones_documentacion.md`.

## 13. Información no verificable desde el repositorio

- Existencia y estado de despliegues públicos.
- Proveedor productivo realmente usado y commit desplegado.
- Disponibilidad, backup y restauración de la base externa.
- Autorizaciones reales de Google, Stripe, Resend, OpenAI o Cloudflare.
- Número de usuarios, clientes, operaciones, ventas o conversiones reales.
- Cumplimiento jurídico integral y conformidad WCAG.
- Resultados académicos, comerciales o de usabilidad.
- Licencias finales de todos los recursos visuales.

**[NO VERIFICABLE]** Véase `anexos/afirmaciones_no_verificables.md`.

## 14. Preguntas que requieren confirmación del autor

1. ¿Cuál es el título oficial, autor, tutor, titulación, centro, curso y convocatoria?
2. ¿El commit `8b12378` con asunto `BASURA` es realmente el corte que debe defenderse?
3. ¿Qué URLs están desplegadas y qué commit ejecuta cada una?
4. ¿Se usa PostgreSQL de Render, otro PostgreSQL, JSON o una combinación en producción?
5. ¿Qué integraciones externas están realmente contratadas y autorizadas?
6. ¿Existen usuarios/pilotos y resultados que puedan publicarse con consentimiento?
7. ¿`data/business-db.json` contiene datos personales reales que deban anonimizarse?
8. ¿Qué licencia tiene el proyecto y cuáles son las licencias/atribuciones de logo, iconos e imágenes?
9. ¿Qué objetivos y requisitos fueron aprobados oficialmente para el TFG?
10. ¿Qué plantilla institucional y estilo de citas debe aplicarse?
11. ¿Se desea presentar Google como prototipo probado o como integración productiva? La evidencia actual solo permite lo primero.
12. ¿El comercio separado de ejemplo forma parte del alcance defendido o debe quedar como línea futura?

## 15. Propuesta razonada de capturas

Se generaron 16 capturas reales con datos ficticios. La selección cubre identidad, navegación, Studio, responsive, Radar, proyectos, CRM, propuestas, agenda, reportes, estado Google, web final y onboarding. Las figuras evitan servicios externos no verificables y distinguen explícitamente el Radar demo.

Prioridad para el cuerpo principal:

1. Studio desktop y preview móvil: demuestran el núcleo de producción y la adaptación de viewport.
2. Radar demo: explica prospección sin fingir datos live.
3. Portal en bandeja, leads, reservas y reportes: representa el ciclo operativo con un fixture coherente.
4. Web de cliente desktop/móvil: demuestra que el renderer compartido produce una salida real.
5. Informe mensual: acredita la salida de reporting.
6. Google no configurado: documenta de forma honesta la integración disponible y sus dependencias ausentes.

Como material secundario: portada, selector de destino, proyectos, propuestas y brief. El catálogo completo, relación con secciones y evidencia técnica figura en `anexos/inventario_capturas.md`.

## Conclusión de auditoría

El repositorio contiene un sistema funcionalmente amplio y ejecutable, no una mera maqueta. Su fortaleza es la continuidad de flujo entre producción web, captación, CRM, agenda, reporting y despliegue configurable, respaldada por pruebas backend y una ejecución aislada. Sus principales límites actuales son la concentración de lógica en `src/app.js`, la inestabilidad de la prueba E2E larga, la heterogeneidad de madurez de integraciones y la diferencia entre configuración de despliegue y operación externa realmente verificable.

La memoria debe describir DLS como un **monolito modular ligero con frontend multipágina, persistencia JSON/PostgreSQL y servicios externos opcionales**, no como un SaaS multiusuario plenamente productivo ni como una plataforma Supabase. Google puede presentarse como integración implementada y probada con simulaciones; Stripe, Resend y OpenAI, como ejemplos o extensiones configurables. Cualquier métrica real, éxito comercial o cumplimiento integral debe quedar pendiente de evidencia del autor.
