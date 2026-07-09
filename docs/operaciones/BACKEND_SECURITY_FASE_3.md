# Backend security - Fase 3

Fecha: 2026-07-08.

## Auditoria local

- El backend no usa Express; es un servidor HTTP nativo en `server/server.mjs`.
- La mayoria de endpoints ya tenian validacion manual de JSON, tamanos maximos y normalizacion de campos.
- Las rutas sensibles `/api/businesses/*`, `/api/demo-publish`, `/api/site-images`, `/api/leads`, `/api/studio/from-opportunity` y `/api/google/*` ya pasaban por token admin o sesion cliente.
- Las sesiones cliente ya limitan el acceso por `businessId` o `businessSlug`.
- No hay Supabase Auth ni SDK Supabase en el repo, asi que la verificacion de JWT de Supabase queda pendiente hasta introducir esa dependencia/arquitectura.
- Huecos detectados:
  - `/api/stock-images` se atendia antes del rate limiter.
  - El rate limiter no cubria login, imagenes, demo publish ni Google.
  - En produccion, si alguien arrancaba el servidor sin `LOCALLIFT_ADMIN_TOKEN`, las rutas admin quedaban abiertas aunque `start:prod` ya lo bloqueaba.
  - No habia guard comun para rechazar `POST`/`PUT`/`PATCH` sin `Content-Type: application/json`.

## Cambios aplicados

- `server/lib/request-guards.mjs`
  - Rechaza metodos `TRACE`.
  - Rechaza URLs API demasiado largas.
  - Rechaza cuerpos declarados por encima de `API_MAX_BODY_BYTES`.
  - Exige `Content-Type: application/json` en `POST`, `PUT` y `PATCH` bajo `/api/*`.

- `server/server.mjs`
  - Ejecuta los guards antes de enrutar endpoints API.
  - Mueve `/api/stock-images` detras del rate limiter.

- `server/lib/public-rate-limit.mjs`
  - Mantiene limites de leads, reservas, eventos y discovery.
  - Anade limites para login cliente, seleccion de imagenes, stock images, tracking de descarga Unsplash, demo publish, Google API y escrituras del Radar.

- `server/lib/admin-auth.mjs`
  - En `NODE_ENV=production`, las rutas admin fallan cerradas si no hay `LOCALLIFT_ADMIN_TOKEN` ni `ADMIN_API_TOKEN`.
  - En desarrollo local se conserva el modo abierto cuando no hay token.

- `server/scripts/test-backend-security.mjs`
  - Comprueba rechazo de JSON mal declarado.
  - Comprueba rate limit de login.
  - Comprueba cierre de admin sin token en produccion.

## Variables nuevas

Documentadas en `.env.example`:

```text
CLIENT_LOGIN_RATE_LIMIT
CLIENT_LOGIN_RATE_LIMIT_WINDOW_MS
SITE_IMAGE_RATE_LIMIT
SITE_IMAGE_RATE_LIMIT_WINDOW_MS
STOCK_IMAGE_RATE_LIMIT
STOCK_IMAGE_RATE_LIMIT_WINDOW_MS
STOCK_IMAGE_DOWNLOAD_RATE_LIMIT
STOCK_IMAGE_DOWNLOAD_RATE_LIMIT_WINDOW_MS
DEMO_PUBLISH_RATE_LIMIT
DEMO_PUBLISH_RATE_LIMIT_WINDOW_MS
GOOGLE_API_RATE_LIMIT
GOOGLE_API_RATE_LIMIT_WINDOW_MS
RADAR_WRITE_RATE_LIMIT
RADAR_WRITE_RATE_LIMIT_WINDOW_MS
API_MAX_BODY_BYTES
API_MAX_URL_BYTES
```

## Pendiente real

- Sustituir validadores manuales por esquemas compartidos tipo Zod/Joi solo si el proyecto acepta nueva dependencia.
- Anadir verificacion de JWT de Supabase cuando exista Supabase Auth en el runtime.
- Revisar `examples/commerce-api.example.mjs` como backend separado si se pone en produccion.
