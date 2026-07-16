# Capturas que no pudieron obtenerse

No se sustituyó ninguna de estas evidencias por una recreación.

| Pantalla o flujo | Motivo | Dependencia ausente | Evidencia disponible | Clasificación |
|---|---|---|---|---|
| Google OAuth completado | El entorno auditado no contiene credenciales Google configuradas. | Cliente OAuth, redirect URI, clave de cifrado y consentimiento. | Rutas conectadas (`server/api/google-api.mjs:71-212`), cifrado (`server/lib/google-auth.mjs:396-430`) y tests simulados. | Parcial / no verificable en producción. |
| Calendar con eventos reales | No se autorizó una cuenta Google. | OAuth y calendario. | Código de free/busy, creación y sincronización de reservas. | Confirmado por código y pruebas, no por servicio real. |
| Business Profile: reseñas, respuesta y rendimiento | API y cuenta externa no disponibles. | Acceso a GBP, ubicación y scopes. | Rutas y manejo de respuestas. | Confirmado por código y pruebas simuladas. |
| Workspace: alta de usuarios | Sin cuenta ni autorización. | Workspace Admin y scopes. | Endpoint conectado. | Parcial / no verificable. |
| Checkout Stripe y webhook | El backend de comercio es un ejemplo independiente, no una ruta del servidor principal. | Ejecutar/desplegar `examples/commerce-api.example.mjs`, claves y webhook. | Ejemplo completo y cliente configurable. | Parcial; no integración productiva del servidor principal. |
| Correo Resend | Solo aparece en el ejemplo de comercio. | Clave Resend y dominio verificado. | Llamada del ejemplo (`examples/commerce-api.example.mjs:902-912`). | Solo ejemplo. |
| Chatbot OpenAI remoto | Solo existe un backend de ejemplo; el endpoint del Studio es configurable. | Servicio de ejemplo, API key y endpoint. | `examples/chatbot-api.example.mjs:37-52`; fallback local operativo. | Parcial; modo local confirmado. |
| Publicación remota Cloudflare | No se usaron cuentas ni tokens externos. | Worker, KV y token. | Worker, configuración y tests locales. | Confirmado por código/pruebas, despliegue no verificable. |
| Persistencia PostgreSQL real | Se evitó conectar a la URL presente en el entorno para no acceder a datos externos. | Instancia autorizada y credenciales de auditoría. | Implementación, Render Blueprint y migrador. | Confirmado por código/configuración; operación externa no verificable. |
| Búsqueda Radar OSM real | La captura priorizó el modo de demostración para evitar dependencia de red y datos de terceros. | Conectividad y consultas Nominatim/Overpass. | Proveedor conectado y tests; captura marcada “datos simulados”. | Implementación confirmada; consulta live no usada como evidencia. |
| Sesión de portal de cliente con contraseña | El fixture no define una contraseña para no almacenar credenciales ni alterar el dato durante la captura. | Hash de acceso ficticio y recorrido de login. | Autenticación scrypt/HMAC y pruebas backend. | Confirmado por código/pruebas; no ilustrado. |
| Secuencia E2E larga del Studio | El objetivo del navegador se cierra al esperar `data-studio-ready`. | Estabilidad del navegador/entorno o diagnóstico adicional. | Error reproducido; capturas 1–4 demuestran un recorrido corto alternativo. | Incidencia de prueba. |

## Error reproducido

La única captura potencialmente sustituible por un error técnico era la secuencia E2E extensa del Studio. Se decidió no incluir una pantalla de navegador bloqueado porque no aporta valor explicativo. El error textual se conserva en `resultados_pruebas.md` y se clasifica como limitación, sin afirmar que la suite E2E haya pasado.
