# Matriz de evidencias

| Afirmación | Clase | Evidencia primaria | Evidencia complementaria |
|---|---|---|---|
| La raíz pública es una landing y el Studio vive en `workspace.html`. | CÓDIGO | `index.html`, `workspace.html` | Test de arquitectura landing/Studio. |
| El Studio comparte renderer con la web de cliente. | CÓDIGO/PRUEBAS | `src/studio/renderer.js`, `src/business/client-site.js` | Figuras 4, 12 y 13. |
| El Studio está dividido en modelos y controladores. | CÓDIGO/PRUEBAS | `src/studio/*-controller.js`, `*-model.js`, `zip-archive.js` | `test:studio-modules`, guard Studio. |
| `src/app.js` cumple el límite acordado. | PRUEBAS | 163.228 bytes, umbral 180.000 | `test:studio-architecture`. |
| El servidor usa un router declarativo de 39 familias. | CÓDIGO/PRUEBAS | `server/http/api-router.mjs` | `test:server-architecture`. |
| Existe persistencia JSON atómica y PostgreSQL. | CÓDIGO/CONFIGURACIÓN | `server/lib/json-store.mjs`, `business-store.mjs` | `render.yaml`. |
| Control DLS y portal cliente son superficies separadas. | CÓDIGO | `pages/admin-dashboard.html`, `pages/client-dashboard.html` | Suites de operaciones/portal. |
| CRM 2 modela cuentas, oportunidades, tareas, consentimiento y Cliente 360. | CÓDIGO/PRUEBAS | APIs y modelos de `server/api/` y `server/lib/` | Scripts `test:crm-*`; entrega CRM 2. |
| Hay usuarios, seis roles y permisos backend. | CÓDIGO/PRUEBAS | `business-access.mjs`, API de seguridad | `test:crm-foundation`. |
| Omnicanalidad, automatizaciones y campañas están conectadas. | CÓDIGO/PRUEBAS | APIs de canal, automatización y campaña | Tests CRM correspondientes. |
| Quote-to-cash y pagos configurables están conectados. | CÓDIGO/PRUEBAS | APIs de quote/payment y proveedor de pago | `test:crm-quote-to-cash`, `test:commerce`. |
| Reservas soportan recursos y lista de espera. | CÓDIGO/PRUEBAS | Modelo/API de booking resources | `test:crm-booking-resources`. |
| Reputación, fidelización e inteligencia están implementadas. | CÓDIGO/PRUEBAS | Módulos de reputation/growth/intelligence | Suites CRM 2. |
| Descubre tu zona y Modo Ruta están implementados. | CÓDIGO/PRUEBAS | servicios/API `zone-*` | `test:zone-discovery`. |
| Google productivo está operativo. | NO VERIFICABLE | No hay evidencia externa. | Figura 16 muestra entorno sin configurar. |
| Canales/pagos productivos están operativos. | NO VERIFICABLE | Se probaron contratos o modo desarrollo. | Requiere cuentas sandbox/productivas. |
| La sintaxis del alcance JavaScript es válida. | PRUEBAS | 260 módulos comprobados | `npm run check`. |
| La suite Studio completa sin E2E pasa. | PRUEBAS | `npm run test:studio` | Incluye QA y guard. |
| Todo el conjunto de pruebas pasa. | REFUTADA | El E2E largo del navegador falla. | `anexos/resultados_pruebas.md`. |
| El despliegue está preparado. | CONFIGURACIÓN | `render.yaml`, `Dockerfile`, `cloudflare/` | Validadores de entorno. |
| Un despliegue público ejecuta este corte. | NO VERIFICABLE | Requiere URL/panel externo. | Ninguna evidencia disponible. |
| El sistema mejora conversiones reales. | NO VERIFICABLE | Requiere piloto y datos externos. | Ninguna evidencia disponible. |

## Jerarquía de confianza

Cuando varias fuentes discrepan se aplica: ejecución controlada y pruebas reproducibles → código conectado → configuración → inferencia explícita → documentación histórica.
