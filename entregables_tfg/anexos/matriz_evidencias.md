# Matriz de evidencias

| Afirmación | Clase | Evidencia primaria | Evidencia complementaria |
|---|---|---|---|
| El runtime principal es HTML/CSS/JS + Node nativo. | CÓDIGO/CONFIGURACIÓN | `index.html:1443-1462`, `server/server.mjs`, `package.json:4` | Figuras 1–16. |
| El Studio comparte renderer con la web de cliente. | CÓDIGO | `src/app.js:219-245`, `src/business/client-site.js:43-78` | Figuras 4, 12 y 13. |
| El servidor tiene API modular. | CÓDIGO | `server/server.mjs:5-20,69-156` | Smoke HTTP. |
| Existe CRUD multi-negocio. | CÓDIGO/PRUEBAS | `server/api/business-api.mjs:14-61` | Smoke y figura 3. |
| CRM, pipeline, deduplicación y timeline están conectados. | CÓDIGO/PRUEBAS | `server/api/contact-api.mjs:34-121` | Tests CRM; figuras 7 y 8. |
| Reservas validan y persisten. | CÓDIGO/PRUEBAS | `server/api/booking-api.mjs:28-140` | Smoke; figura 11. |
| Hay reporting mensual/comercial. | CÓDIGO/PRUEBAS/EJECUCIÓN | `server/api/report-api.mjs:25-70` | Figura 15 y tests de informes. |
| Hay persistencia JSON atómica. | CÓDIGO | `server/lib/json-store.mjs:1-25` | Health de captura. |
| Hay persistencia PostgreSQL implementada. | CÓDIGO/CONFIGURACIÓN | `server/lib/business-store.mjs:202-215,251-355` | `render.yaml:18-20`. |
| El login cliente usa scrypt y sesión HMAC. | CÓDIGO/PRUEBAS | `server/lib/client-auth.mjs:105-106,213-224,268` | Seguridad backend. |
| El token admin falla cerrado en producción. | CÓDIGO/PRUEBAS | `server/lib/admin-auth.mjs:54,113-130` | Smoke/security. |
| OAuth Google cifra tokens. | CÓDIGO/PRUEBAS | `server/lib/google-auth.mjs:396-430` | `test:google`. |
| Google productivo está operativo. | NO VERIFICABLE | No hay evidencia externa. | Figura 16 muestra precisamente que falta configuración. |
| Stripe está en el servidor principal. | REFUTADA | No hay rutas `/api/store` en `server/server.mjs`. | Ejemplo en `examples/commerce-api.example.mjs`; admin en 8795. |
| Chatbot local funciona sin OpenAI. | CÓDIGO/PRUEBAS | Fallback en `src/app.js:5285-5310` y exporter. | Web generada en figuras 3/4. |
| OpenAI productivo está operativo. | NO VERIFICABLE/PARCIAL | Solo `examples/chatbot-api.example.mjs:37-52`. | Endpoint remoto configurable. |
| Radar permite modo OSM y modo demo. | CÓDIGO/EJECUCIÓN | `src/radar/discovery-provider.js:91-104` | Figura 7, marcada demo. |
| Se pueden exportar HTML, JSON y ZIP. | CÓDIGO/PRUEBAS | `src/app.js:3080-3129,5850-6358` | Tests renderer/exporter. |
| La QA visual pasa. | PRUEBAS | `npm run test:qa-visual` | Salida archivada en resultados. |
| Todo el conjunto de pruebas pasa. | REFUTADA | Arquitectura y browser E2E fallan. | `anexos/resultados_pruebas.md`. |
| El despliegue en Render está preparado. | CONFIGURACIÓN | `render.yaml`, `Dockerfile` | Validador de entorno. |
| Render ejecuta este commit. | NO VERIFICABLE | Requiere panel/URL externa. | Ninguna. |
| El sistema tiene usuarios/clientes reales y mejora conversiones. | NO VERIFICABLE | Requiere estudio y datos externos. | Ninguna. |

## Jerarquía de confianza

Cuando varias fuentes discrepan se ha aplicado: ejecución controlada y pruebas reproducibles → código conectado → configuración → inferencia explícita → documentación histórica. La configuración de un servicio externo demuestra capacidad de despliegue, no la existencia del despliegue.
