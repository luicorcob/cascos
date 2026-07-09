# Cloudflare - Fase 5

Fecha: 2026-07-09.

## Auditoria local

- El repositorio no contiene Terraform ni Rulesets API para Cloudflare WAF,
  SSL/TLS, Bot Fight Mode o rate limiting de zona.
- La pieza Cloudflare versionada es el Worker `dls-demo-publisher`, con KV
  `DEMOS`, token privado en secret, CORS por origen exacto, HSTS y cabeceras
  de seguridad.
- El backend principal ya tiene guards y rate limiting internos. Cloudflare se
  configura como primera barrera para absorber abuso antes de que llegue al
  origen.
- No se puede afirmar que la fase este aplicada hasta activar y validar las
  reglas en el dashboard de Cloudflare.

## Ambito

Aplicar estas reglas a los hosts publicos que pasen por Cloudflare:

- Web publica y dashboard: `www.tu-dominio.com` / `app.tu-dominio.com`.
- API backend: `api.tu-dominio.com` o el host que apunte a Render/Railway/Fly.
- Worker de demos si se expone con dominio propio: `demos.tu-dominio.com`.

Mantener `workers.dev` solo para pruebas internas si no hay dominio propio.

## HTTPS y HSTS

1. En `SSL/TLS > Overview`, usar `Full (strict)` cuando el origen tenga
   certificado valido. No usar `Off`.
2. En `SSL/TLS > Edge Certificates`, activar `Always Use HTTPS`.
3. Activar `HTTP Strict Transport Security (HSTS)` cuando todos los subdominios
   publicos funcionen por HTTPS.
4. Configuracion recomendada inicial:
   - `max-age`: `6 months` (`15552000` segundos, igual que el backend).
   - `includeSubDomains`: activar solo si todos los subdominios usan HTTPS.
   - `preload`: no activar en MVP; revisarlo cuando la zona sea estable.
   - `No-Sniff`: activar si esta disponible en la opcion de HSTS.

Validacion:

```powershell
curl.exe -I http://api.tu-dominio.com/api/health
curl.exe -I https://api.tu-dominio.com/api/health
curl.exe -I https://demos.tu-dominio.com/api/health
```

El primer comando debe redirigir a HTTPS. Las respuestas HTTPS deben incluir
`strict-transport-security`.

## WAF

Activar en `Security > WAF > Managed rules`:

- Plan Free: `Cloudflare Free Managed Ruleset`.
- Plan Pro o superior: `Cloudflare Managed Ruleset` y `Cloudflare OWASP Core
  Ruleset`.

Modo recomendado:

- Empezar con acciones por defecto del ruleset.
- Revisar `Security > Events` tras probar login, formularios, dashboard,
  publicacion de demos e imagenes.
- Crear excepciones solo para falsos positivos concretos y documentados.

No crear excepciones globales para `/api/*`; eso anularia justo la proteccion
de inyecciones y abuso que se quiere cubrir.

## Bot Fight Mode

Activar `Bot Fight Mode` en `Security > Settings` filtrando por `Bot traffic`,
si la zona sirve formularios publicos o demos compartidas.

Precaucion:

- Bot Fight Mode afecta al dominio completo y no se puede saltar con reglas WAF
  normales.
- Si rompe clientes API propios, monitores o integraciones legitimas, desactivar
  Bot Fight Mode y pasar a Super Bot Fight Mode o reglas WAF mas granulares.
- La CSP actual permite scripts de `self` e inline; si se endurece la CSP en el
  futuro, comprobar que `/cdn-cgi/challenge-platform/` sigue funcionando.

Validar en `Security > Events` que las acciones aparecen como `Bot Fight Mode`
y que no bloquean flujos legitimos.

## Rate limiting en Cloudflare

El backend mantiene limites internos por ventana larga. Cloudflare debe cortar
rafagas y bots antes del origen.

### Regla minima para plan Free

El plan Free puede tener menos reglas y ventanas mas cortas. Usar una regla
consolidada:

- Nombre: `DLS critical API burst protection`.
- Expresion:

```text
(
  http.request.method in {"POST" "PUT" "PATCH" "DELETE"}
  and
  (
    http.request.uri.path eq "/api/client/login"
    or http.request.uri.path eq "/api/demo-publish"
    or http.request.uri.path eq "/api/site-images"
    or http.request.uri.path eq "/api/stock-images/download"
    or http.request.uri.path eq "/api/leads"
    or http.request.uri.path eq "/api/studio/from-opportunity"
    or starts_with(http.request.uri.path, "/api/public/")
  )
)
```

- Caracteristica: `IP`.
- Periodo: `10 seconds`.
- Umbral inicial: `20 requests`.
- Mitigacion: `Managed Challenge` durante `10 seconds`.

Esta regla no sustituye los limites internos de 10 minutos/1 hora; solo frena
rafagas agresivas en el borde.

### Reglas recomendadas si el plan permite varias reglas

| Nombre | Expresion | Umbral | Accion |
| --- | --- | --- | --- |
| `DLS client login` | `http.request.method eq "POST" and http.request.uri.path eq "/api/client/login"` | 10 / 10 min / IP | Managed Challenge o Block |
| `DLS public forms` | `http.request.method eq "POST" and starts_with(http.request.uri.path, "/api/public/") and (ends_with(http.request.uri.path, "/leads") or ends_with(http.request.uri.path, "/bookings"))` | 6 / 10 min / IP | Managed Challenge |
| `DLS demo publish` | `http.request.method eq "POST" and http.request.uri.path eq "/api/demo-publish"` | 12 / 1 h / IP | Block |
| `DLS image providers` | `(http.request.method eq "POST" and http.request.uri.path eq "/api/site-images") or (http.request.method eq "GET" and http.request.uri.path eq "/api/stock-images")` | 30 / 10 min / IP | Managed Challenge |
| `DLS radar writes` | `http.request.method eq "POST" and (http.request.uri.path eq "/api/leads" or http.request.uri.path eq "/api/studio/from-opportunity")` | 30 / 10 min / IP | Block |
| `DLS google admin API` | `starts_with(http.request.uri.path, "/api/google/") and http.request.uri.path ne "/api/google/oauth/callback"` | 60 / 10 min / IP | Managed Challenge |

Mantener `/api/health` sin rate limit agresivo para healthchecks del proveedor.

## Bloqueos por pais o IP

No bloquear paises por defecto. Activar reglas de bloqueo solo si `Security >
Events`, logs del origen o analitica de abuse muestran patrones claros.

Opciones prudentes:

- Crear una lista `dls_blocked_ips` y bloquear solo IPs/ASN reincidentes.
- Bloquear paises solo para endpoints admin (`/api/businesses/*`,
  `/api/google/*`, `/api/demo-publish`) y nunca para webs de clientes sin
  validar impacto comercial.
- Revisar cada bloqueo tras 7 dias.

## Prueba funcional tras aplicar

1. Abrir la web publica y el dashboard desde navegador real.
2. Enviar un lead publico a `/api/public/{slug}/leads`.
3. Crear una reserva publica a `/api/public/{slug}/bookings`.
4. Comprobar `POST /api/client/login`.
5. Publicar una demo temporal desde el Studio.
6. Pedir imagenes desde el Studio.
7. Revisar `Security > Events` y confirmar que solo se bloquea trafico anomalo.

## Fuentes oficiales

- Cloudflare WAF Managed Rules:
  <https://developers.cloudflare.com/waf/managed-rules/>
- Cloudflare Rate Limiting Rules:
  <https://developers.cloudflare.com/waf/rate-limiting-rules/>
- Cloudflare Always Use HTTPS:
  <https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/>
- Cloudflare HSTS:
  <https://developers.cloudflare.com/ssl/edge-certificates/additional-options/http-strict-transport-security/>
- Cloudflare Bot Fight Mode:
  <https://developers.cloudflare.com/bots/get-started/bot-fight-mode/>
