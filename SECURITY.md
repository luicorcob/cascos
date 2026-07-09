# Security

Este documento resume el estado de seguridad local de DLS Studio y deja
registrada la configuracion operativa que debe mantenerse fuera del codigo.

## Estado del plan

- Fase 1, secretos: variables documentadas en `.env.example`; los secretos
  reales deben vivir en Render, Cloudflare secrets o el proveedor equivalente.
- Fase 2, Supabase RLS: SQL y runbook generados en
  `docs/operaciones/SUPABASE_RLS_FASE_2.md`; pendiente de aplicar en una
  instancia real.
- Fase 3, backend: guards comunes, auth admin cerrada en produccion y rate
  limiting interno documentados en `docs/operaciones/BACKEND_SECURITY_FASE_3.md`.
- Fase 4, CORS y cabeceras: CORS de produccion sin wildcard, CSP, HSTS y
  cabeceras de seguridad documentadas en
  `docs/operaciones/HTTP_SECURITY_FASE_4.md`.
- Fase 5, Cloudflare: runbook de WAF, HTTPS/HSTS, Bot Fight Mode, rate limiting
  y bloqueos opcionales documentado en
  `docs/operaciones/CLOUDFLARE_FASE_5.md`.
- Fase 6, dependencias: auditoria npm en GitHub Actions y Dependabot
  documentados en `docs/operaciones/DEPENDENCIAS_FASE_6.md`.
- Fase 7, logging y monitorizacion: logs JSON, access logs, alertas de auth y
  politica de backups documentados en
  `docs/operaciones/LOGGING_MONITORIZACION_FASE_7.md`.
- Fase 8, checklist final: escaneo local de secretos, auditoria de dependencias
  y gates externos documentados en
  `docs/operaciones/CHECKLIST_FINAL_FASE_8.md`.

## Medidas activas en codigo

- `.env` y variantes locales no deben versionarse; `.env.example` solo contiene
  nombres de variables sin valores reales.
- `LOCALLIFT_ADMIN_TOKEN` protege rutas administrativas en produccion.
- `CORS_ORIGIN` debe contener origenes HTTPS exactos en produccion.
- Las rutas API rechazan `TRACE`, URLs demasiado largas, cuerpos declarados por
  encima del limite y mutaciones sin `Content-Type: application/json`.
- Endpoints publicos y costosos tienen rate limiting interno por IP.
- El backend y el Worker de demos emiten cabeceras de seguridad, incluyendo CSP,
  `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`,
  `Referrer-Policy` y HSTS cuando corresponde.
- `.github/workflows/dependency-audit.yml` ejecuta
  `npm audit --audit-level=high` en cada PR y falla ante vulnerabilidades altas
  o criticas.
- `server/lib/structured-logger.mjs` registra accesos, errores y fallos de
  autenticacion como JSON, con redaccion de passwords, tokens, cookies, secrets
  y cabeceras sensibles.
- Las respuestas del backend incluyen `X-Request-Id` para correlacionar errores
  de cliente con logs privados.
- Los fallos repetidos de autenticacion generan `auth_failure_alert` segun
  `AUTH_FAILURE_ALERT_THRESHOLD` y `AUTH_FAILURE_ALERT_WINDOW_MS`.
- `npm run security:phase8` escanea el arbol actual, `.gitignore`, archivos
  `.env` versionados y `git log -p --all` para detectar formatos conocidos de
  secretos o asignaciones reales de credenciales.

## Checklist final

- Ultimo escaneo local de fase 8: 2026-07-09,
  `npm.cmd run security:phase8` con resultado sin hallazgos.
- `gitleaks` no estaba instalado localmente; ejecutar
  `gitleaks detect --source . --redact` como segunda opinion antes del go-live
  si esta disponible en CI o en otra maquina.
- No marcar RLS, backups Supabase ni Cloudflare/HTTPS como verificados en
  produccion hasta aplicar las configuraciones en las instancias reales y
  guardar evidencia operativa.

## Logging y monitorizacion

- Mantener `ACCESS_LOGS=true` en produccion salvo que el proveedor ya capture
  access logs equivalentes.
- No enviar logs del backend a canales publicos ni issues; pueden contener IPs,
  rutas y nombres de negocio aunque los secretos se redacten.
- Revisar eventos `auth_failure_alert` como posible fuerza bruta contra
  `/api/client/login`, `/api/client/session` o rutas admin.
- Conectar stdout/stderr del proveedor a un sistema de alertas cuando haya
  clientes reales.

## Dependencias y supply chain

- `.github/dependabot.yml` revisa dependencias npm y GitHub Actions cada semana.
- Antes de anadir paquetes, revisar mantenimiento, licencia, arbol transitivo y
  necesidad real frente a APIs nativas o codigo existente.
- Ultima auditoria local documentada: 2026-07-09,
  `npm.cmd audit --audit-level=high` con resultado `found 0 vulnerabilities`.

## Cloudflare

La configuracion real de Cloudflare vive en el dashboard. Para produccion,
mantener:

- WAF Managed Rules activo.
- `Always Use HTTPS` activo.
- HSTS activo despues de validar todos los subdominios HTTPS.
- Rate limiting de borde en login, formularios publicos, publicacion de demos,
  imagenes, Radar y Google admin API.
- Bot Fight Mode activo si hay formularios publicos, salvo que rompa clientes
  API legitimos.
- Bloqueos por pais/IP solo con evidencia en `Security > Events`.

No marcar esta fase como aplicada hasta revisar los eventos de Cloudflare y
probar los flujos principales de usuario.

## Backups Supabase

Cuando exista una instancia Supabase productiva:

- Activar backups automaticos antes de migrar datos reales de clientes.
- Activar Point-in-Time Recovery si el plan lo permite.
- Ejecutar una restauracion de prueba mensual en un proyecto o base temporal.
- Verificar tablas criticas, conteos principales y acceso con RLS tras restaurar.
- Registrar evidencia de fecha, backup restaurado, destino temporal, tablas
  verificadas, resultado y responsable.
- No marcar backups como verificados hasta completar al menos una restauracion
  correcta.

## Reporte de problemas

No publiques secretos ni datos personales en issues o commits. Si aparece una
key, token o password en el historial, hay que rotarlo en el proveedor aunque se
borre del repo.
