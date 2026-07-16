# Afirmaciones no verificables desde el repositorio

Las siguientes afirmaciones no deben presentarse como hechos sin documentación o evidencia externa adicional.

| Afirmación potencial | Estado | Evidencia necesaria |
|---|---|---|
| Existe un despliegue público actualmente operativo | No verificable | URL, respuesta del servicio, titularidad y fecha de comprobación. |
| Render ejecuta la versión auditada | No verificable | Panel o API de Render con commit desplegado y variables no sensibles. |
| La base PostgreSQL productiva existe, contiene datos válidos y tiene copias restaurables | No verificable | Instancia, esquema aplicado, prueba de backup y restauración. |
| Cloudflare Worker/KV publica demos reales | No verificable | URL del Worker, binding KV y prueba de publicación/expiración. |
| Google OAuth, Calendar, Business Profile, Places o Workspace están autorizados en producción | No verificable | Credenciales configuradas, consentimiento, scopes concedidos y llamadas reales autorizadas. |
| Stripe cobra pedidos reales | No verificable | Servicio de comercio separado desplegado, claves, webhook y transacción de prueba. |
| Resend envía correo transaccional real | No verificable | Cuenta, dominio y envío registrado. |
| El chatbot remoto usa OpenAI en producción | No verificable | Endpoint configurado y llamada registrada; en el servidor principal solo hay modo local/configurable. |
| Hay clientes, usuarios o negocios reales usando la aplicación | No verificable | Consentimiento del autor y métricas anonimizadas. |
| Se han obtenido mejoras de conversión, ventas, tiempo o satisfacción | No verificable | Diseño de evaluación, línea base, muestra y resultados. |
| La aplicación cumple RGPD/LOPDGDD de forma integral | No verificable | Análisis jurídico, registro de tratamientos, contratos, plazos y procedimientos reales. |
| La aplicación cumple WCAG a un nivel determinado | No verificable | Auditoría completa, tecnologías asistivas y criterio de conformidad. |
| El WAF/CDN de Cloudflare protege el dominio productivo | No verificable | Zona, reglas, DNS y eventos reales. |
| Los secretos históricos nunca estuvieron expuestos | No verificable | Auditoría completa de historia Git y rotación en proveedores. |
| Las imágenes externas disponen de licencia válida para el uso final | No verificable de forma global | Inventario de cada recurso, licencia y atribución vigente. |
| El commit actual representa la versión definitiva del TFG | Requiere autor | Confirmación expresa; el asunto del commit es `BASURA`. |

## Metadatos académicos pendientes

- Título oficial del TFG.
- Nombre completo del autor.
- Tutor o tutora.
- Titulación, centro y universidad.
- Curso académico y convocatoria.
- Plantilla institucional, extensión máxima y norma bibliográfica.

## Datos y evaluación pendientes

- Objetivos académicos aprobados y criterios de evaluación.
- Motivación personal o empresarial del autor.
- Cronología real, horas dedicadas y metodología de gestión usada.
- Personas que participaron en pruebas UX y consentimiento para citarlas.
- Resultados comerciales o de usuarios que puedan publicarse.
- URLs productivas y proveedores efectivamente contratados.
- Confirmación de que `data/business-db.json` no contiene datos personales que deban anonimizarse antes de entregar el repositorio.

La memoria usa marcadores explícitos para estos extremos y no inventa respuestas.
