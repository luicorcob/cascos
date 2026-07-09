# CORS y cabeceras HTTP - Fase 4

Fecha: 2026-07-08.

## Auditoria local

- El backend principal ya tenia `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Cache-Control: no-store`.
- `CORS_ORIGIN` ya existia y `start:prod` exigia al menos un origen HTTPS.
- Huecos detectados:
  - Si alguien arrancaba `NODE_ENV=production` sin `start:prod`, CORS podia caer a `*`.
  - Un origen no permitido recibia el primer origen permitido en `Access-Control-Allow-Origin`; el navegador lo bloqueaba, pero era menos claro que no enviar cabecera.
  - Faltaba `X-LocalLift-Client-Token` en `Access-Control-Allow-Headers`.
  - Faltaban `Content-Security-Policy`, `X-Frame-Options`, `Permissions-Policy` y HSTS en el backend principal.
  - El publicador Cloudflare de demos tenia `CORS_ORIGIN="*"` en `wrangler`.

## Cambios aplicados

- `server/lib/security-headers.mjs`
  - Centraliza cabeceras de seguridad del backend principal.
  - Anade CSP, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, `nosniff`, `Referrer-Policy` y `Cache-Control`.
  - Anade HSTS solo en `NODE_ENV=production`.

- `server/lib/cors.mjs`
  - En produccion sin origenes configurados ya no devuelve `*`.
  - Para origenes no permitidos no devuelve `Access-Control-Allow-Origin`.
  - Permite `X-LocalLift-Client-Token` para el portal cliente separado.

- `server/scripts/validate-deploy-env.mjs`
  - `CORS_ORIGIN` de produccion debe contener solo origenes HTTPS exactos.
  - Rechaza `*`, `null`, `localhost` y `127.0.0.1` en produccion.

- `cloudflare/demo-publisher-worker.js`
  - El Worker de demos acepta lista de origenes exactos separados por coma.
  - Ignora `*` como wildcard.
  - Anade cabeceras de seguridad equivalentes para respuestas JSON/texto/HTML.

- `cloudflare/wrangler.demo-publisher.toml*`
  - Sustituye `CORS_ORIGIN="*"` por origenes locales explicitos para desarrollo.

## Decisiones

- Se usa `SAMEORIGIN`, no `DENY`, porque `pages/investor.html` incrusta el Studio en un iframe del mismo origen.
- La CSP permite iframes de Google Maps y YouTube porque el generador puede incluir mapa embed y enlaces de video.
- La CSP conserva `unsafe-inline` para scripts/estilos porque el Studio y las webs exportadas usan HTML standalone con estilos y scripts embebidos.

## Verificacion

- `npm.cmd run test:backend-security`
- `npm.cmd run test:demo-worker`
- `npm.cmd run smoke:pilot`
- `npm.cmd run check`
