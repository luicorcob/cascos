# Logging y monitorizacion - Fase 7

Fecha: 2026-07-09.

## Auditoria local

- El backend usa HTTP nativo en `server/server.mjs`; no hay middleware Express.
- Antes de esta fase solo habia `console.log`/`console.error` puntuales.
- Los errores enviados al cliente ya eran genericos en produccion, pero no habia
  trazabilidad uniforme por peticion.
- Los fallos de login cliente y token admin estaban protegidos por rate limiting,
  pero no generaban alerta estructurada por repeticion.
- El repo no contiene SDK ni configuracion activa de Supabase; las politicas RLS
  existen como entregable de fase 2, asi que la verificacion de backups debe
  hacerse en el dashboard o CLI de la instancia real.

## Cambios aplicados

- `server/lib/structured-logger.mjs`
  - Crea logs JSON con `ts`, `level`, `event` y campos estructurados.
  - Redacta claves sensibles por nombre (`authorization`, `password`, `token`,
    `secret`, `api_key`, `cookie`, `session`, etc.).
  - Redacta patrones sensibles en strings como `Bearer ...` o `token=...`.
  - Registra accesos al terminar cada respuesta sin incluir query strings.
  - Registra errores internos con stack en logs, configurable con `LOG_STACKS`.
  - Mantiene contadores en memoria de fallos de autenticacion por ruta/IP/razon.

- `server/server.mjs`
  - Anade `X-Request-Id` por peticion.
  - Registra access logs con metodo, path, IP, origen, user agent, status y
    duracion.
  - Registra errores no manejados con `logError`.
  - Cambia el log de arranque a JSON estructurado.

- `server/lib/admin-auth.mjs`
  - Registra fallos de token admin ausente/invalido.
  - Registra intentos de usar sesion cliente en rutas no permitidas.
  - Limpia contadores de alerta al autenticar correctamente desde la misma IP y
    ruta.

- `server/lib/client-auth.mjs`
  - Registra credenciales invalidas de portal cliente.
  - Registra sesiones cliente invalidas o caducadas.
  - Limpia contadores al iniciar sesion o validar sesion correctamente.

- `server/scripts/test-backend-security.mjs`
  - Comprueba redaccion de tokens/passwords.
  - Comprueba que los fallos repetidos generan `auth_failure_alert`.

## Variables

Documentadas en `.env.example`:

```text
LOG_LEVEL=info
ACCESS_LOGS=true
LOG_STACKS=true
AUTH_FAILURE_ALERT_THRESHOLD=5
AUTH_FAILURE_ALERT_WINDOW_MS=600000
```

Recomendacion de produccion:

- `LOG_LEVEL=info`.
- `ACCESS_LOGS=true` mientras no exista otro access log fiable del proveedor.
- `LOG_STACKS=true` solo en logs privados del backend, nunca en respuestas HTTP.
- Ajustar `AUTH_FAILURE_ALERT_THRESHOLD` segun trafico real; empezar en `5`
  fallos por IP/ruta/ventana.

## Eventos de log relevantes

- `server_start`: arranque del servidor.
- `access`: acceso HTTP completado.
- `request_aborted`: conexion cerrada antes de completar respuesta.
- `error`: excepcion interna registrada por el servidor.
- `auth_failure`: fallo de autenticacion individual.
- `auth_failure_alert`: alerta por fallos repetidos en la ventana configurada.

Ejemplo:

```json
{"ts":"2026-07-09T10:00:00.000Z","level":"warn","event":"auth_failure_alert","reason":"admin_token_invalid_or_missing","request":{"method":"GET","path":"/api/businesses","ip":"203.0.113.10"},"count":5,"threshold":5,"severity":"high"}
```

## Politica de backups Supabase

Cuando DLS use una instancia real de Supabase:

1. Activar backups automaticos del proyecto antes de mover datos de clientes.
2. Mantener Point-in-Time Recovery si el plan contratado lo permite.
3. Programar una prueba mensual de restauracion en un proyecto/base temporal.
4. Guardar evidencia de cada prueba: fecha, backup restaurado, tablas revisadas,
   conteos principales y responsable.
5. No usar datos reales en entornos de prueba sin minimizacion o autorizacion.
6. Documentar incidentes de restauracion fallida y corregirlos antes de cerrar
   la fase como verificada.

Evidencia minima para marcar backups como verificados:

```text
Fecha:
Proyecto Supabase:
Backup o PITR usado:
Destino temporal:
Tablas verificadas:
Conteos antes/despues:
Resultado:
Responsable:
```

## Pendiente externo

La fase queda aplicada en codigo para logging, errores y alertas de auth.
La parte de backups Supabase queda como runbook hasta que exista una instancia
real donde activar backups automaticos y ejecutar una restauracion de prueba.
