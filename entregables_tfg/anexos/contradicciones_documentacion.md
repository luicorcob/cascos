# Registro de contradicciones entre código y documentación

Actualizado el 23 de julio de 2026. El registro no implica que los documentos fueran incorrectos en su fecha: indica qué afirmaciones han quedado resueltas o deben conservarse solo como historia.

| ID | Afirmación anterior | Evidencia actual | Evaluación |
|---|---|---|---|
| C-01 | `src/app.js` había regresado a más de 253 KB y superaba el guard. | Tras la extracción mide 163.228 bytes; `test:studio-architecture` pasa. | Resuelta por refactorización. |
| C-02 | La arquitectura modular estaba protegida solo en frontend. | Existe además `test:server-architecture`; `server.mjs` mide 6.472 bytes. | Ampliada y resuelta. |
| C-03 | El flujo Studio completo estaba verificado en navegador. | `test:studio-browser` sigue reproduciendo `Target crashed`; las pruebas cortas y QA sí pasan. | Sigue abierta con alcance parcial. |
| C-04 | PostgreSQL era trabajo futuro. | Driver, migrador y Render Blueprint presentes. | Histórica; JSON continúa como modo local. |
| C-05 | La raíz `index.html` abría el Studio. | `index.html` es landing y `workspace.html` abre el Studio. | Histórica; las figuras 1–2 muestran la entrada anterior. |
| C-06 | Había un único portal operativo. | Control DLS (`admin-dashboard`) y portal cliente (`client-dashboard`) están separados. | Histórica. |
| C-07 | No existía IAM interno con roles. | Usuarios de negocio, seis roles, sesiones, revocación y matriz backend por recurso/acción. | Resuelta en CRM 2. |
| C-08 | Contacto y pipeline representaban todo el ciclo comercial. | Existen cuentas, oportunidades, tareas, asociaciones, consentimiento y Cliente 360. | Histórica. |
| C-09 | Mensajería solo preparaba `wa.me`/`mailto`. | Conversaciones, canales, automatizaciones y campañas están en el servidor principal. | Histórica; envío live no verificado. |
| C-10 | Comercio y Stripe vivían únicamente en un ejemplo separado. | `commerce-api.mjs` y la capa de pagos están montados en el servidor principal; el ejemplo permanece como referencia. | Histórica; cobros live no verificados. |
| C-11 | Agenda solo modelaba servicio, horario, bloqueo y reserva. | Recursos, capacidad, waitlist, depósitos, checkout y políticas tienen modelo/API/pruebas. | Histórica. |
| C-12 | Google era solo ejemplo futuro. | OAuth, cifrado y rutas operativas están conectados al backend principal. | Histórica respecto al código; cuenta live no verificable. |
| C-13 | Supabase DB/Auth era el runtime. | El runtime principal usa JSON/PostgreSQL directo; SQL de Supabase es preparatorio/opcional. | Solo documentación/plan. |
| C-14 | Configuración Render/Cloudflare demostraba despliegue. | Demuestra preparación, no existencia de un servicio externo correspondiente al corte. | Debe etiquetarse como configuración. |
| C-15 | Las dieciséis capturas inventariaban el producto actual. | Son del 16 de julio; no incluyen landing, CRM 2, paneles separados o zona. | Válidas como evidencia histórica, incompletas como inventario actual. |

## Criterio aplicado

La memoria presenta primero el estado medido del 23 de julio y conserva el corte anterior solo cuando explica evolución. La jerarquía es: ejecución/pruebas → código conectado → configuración → inferencia → documentación histórica.
