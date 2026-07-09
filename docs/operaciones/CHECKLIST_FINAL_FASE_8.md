# Checklist final antes de produccion - Fase 8

Fecha: 2026-07-09.

## Resultado ejecutivo

La fase 8 queda cerrada a nivel local:

- No se detectaron secretos con formatos conocidos en el arbol actual ni en el
  historial completo de Git.
- `.env` y variantes locales estan ignorados; el unico archivo de entorno
  versionado es `.env.example`.
- `npm audit --audit-level=high` devuelve `found 0 vulnerabilities`.
- Las pruebas de seguridad del backend pasan.

Limitacion importante: RLS de Supabase, backups restaurados y reglas reales de
Cloudflare/HTTPS siguen dependiendo de dashboards o instancias productivas. No
deben marcarse como verificados en produccion hasta aplicarlos y guardar
evidencia.

## Escaneo de secretos

`gitleaks` no esta instalado en esta maquina (`Get-Command gitleaks` no
devuelve binario). Para dejar la fase repetible sin descargar herramientas se
anadio:

```powershell
npm.cmd run security:phase8
```

El script `server/scripts/check-security-phase-8.mjs`:

- Verifica que `.gitignore` contenga `.env`, `.env.*` y `!.env.example`.
- Comprueba que no haya `.env` real versionado.
- Escanea archivos versionables y no ignorados.
- Escanea `git log -p --all` excluyendo `assets/vendor` y `package-lock.json`.
- Detecta formatos habituales de secretos: AWS, Google API keys, Stripe,
  GitHub, Slack, SendGrid, JWT y claves OpenAI.
- Falla ante asignaciones no placeholder de variables `KEY`, `TOKEN`, `SECRET`
  o `PASSWORD`.

Resultado:

```text
Phase 8 security scan passed: no known secret formats or non-placeholder credential assignments found.
```

Las pasadas manuales con `rg` sobre historial y arbol actual no encontraron
formatos reales de secreto. Las coincidencias genericas restantes eran nombres
de variables, placeholders (`<token-largo>`, `change-me-use...`, `...`) o
referencias documentales.

## Checklist de fase 8

| Control | Estado | Evidencia |
| --- | --- | --- |
| Ningun secreto en repo/historial | OK local | `npm.cmd run security:phase8`; `git ls-files -- .env .env.*` solo lista `.env.example`. |
| RLS activo y probado | Pendiente externo | SQL y runbook en `docs/operaciones/SUPABASE_RLS_FASE_2.md`; falta aplicarlo en Supabase real y probar `anon`, `authenticated` y miembro. |
| CORS restringido | OK en codigo | `server/lib/cors.mjs` y `server/scripts/validate-deploy-env.mjs`; en produccion falta fijar dominios reales en `CORS_ORIGIN`. |
| Rate limiting activo | OK en codigo | Cubierto por `server/lib/public-rate-limit.mjs` y `npm.cmd run test:backend-security`. |
| HTTPS forzado | Pendiente externo | Runbook en `docs/operaciones/CLOUDFLARE_FASE_5.md`; falta validar Cloudflare/Render en dominio real. |
| Dependencias sin vulnerabilidades altas o criticas | OK local y CI | `npm.cmd audit --audit-level=high` con `found 0 vulnerabilities`; workflow `Dependency audit`. |
| `.env.example` documentado y `.env` fuera del repo | OK local | `.gitignore` ignora `.env` y `.env.*`, salvo `.env.example`. |

## Comandos ejecutados

```powershell
Get-Command gitleaks -ErrorAction SilentlyContinue
node --check server\scripts\check-security-phase-8.mjs
npm.cmd run security:phase8
npm.cmd run test:backend-security
$env:NODE_OPTIONS='--use-system-ca'; $env:npm_config_cache='.npm-cache'; npm.cmd audit --audit-level=high
git ls-files -- .env .env.*
```

Resultados:

- `gitleaks`: no instalado localmente.
- `node --check`: sin errores de sintaxis.
- `security:phase8`: passed.
- `test:backend-security`: `Backend security checks passed.`
- `npm audit`: `found 0 vulnerabilities`.
- `git ls-files -- .env .env.*`: solo `.env.example`.

## Gates antes de produccion real

1. Ejecutar `docs/operaciones/supabase_rls_fase_2.sql` en la instancia
   Supabase real, probar politicas y guardar evidencia de `pg_policies`.
2. Activar/verificar backups Supabase y restaurar una copia de prueba.
3. Configurar `CORS_ORIGIN` con dominios HTTPS reales.
4. Activar WAF, HTTPS, HSTS, Bot Fight Mode y rate limiting de Cloudflare.
5. Ejecutar `gitleaks detect --source . --redact` en CI o en una maquina donde
   este instalado, como segunda opinion antes del go-live.
