# Publicar demos gratis con Cloudflare Workers

Esta opcion sirve para que `Publicar demo` devuelva un enlace publico tipo
`https://dls-demo-publisher.tu-cuenta.workers.dev/demos/...` aunque estes usando
el Studio en local. La demo se guarda en Workers KV y caduca sola.

## Por que Cloudflare

- Workers tiene plan gratuito con uso limitado.
- Workers KV incluye plan gratuito con 1 GB y operaciones diarias suficientes
  para demos comerciales pequenas.
- KV permite `expirationTtl`, asi que Cloudflare borra la demo al caducar.
- No hay que dejar el portatil encendido para que el cliente abra el enlace.

## Alta una sola vez, casi automatica

1. Crea o entra en tu cuenta de Cloudflare.
2. Autentica Wrangler una vez:

```powershell
npx wrangler login
```

3. Ejecuta el setup automatico:

```powershell
npm.cmd run setup:demo-online
```

El script hace esto por ti:

- Crea `cloudflare/wrangler.demo-publisher.toml` desde la plantilla si no existe.
- Crea el namespace KV `DEMOS` si falta.
- Genera un token largo de publicacion si no defines uno.
- Guarda `DEMO_PUBLISH_TOKEN` como secret del Worker.
- Despliega el Worker.
- Guarda `DEMO_REMOTE_PUBLISH_URL`, `DEMO_REMOTE_PUBLISH_TOKEN` y
  `DEMO_PUBLISH_TTL_HOURS` en `.env`.

Si quieres fijar tu propio token o caducidad antes del setup:

```powershell
$env:DEMO_PUBLISH_TOKEN="usa-un-token-largo-aleatorio"
$env:DEMO_PUBLISH_TTL_HOURS="24"
npm.cmd run setup:demo-online
```

Al final veras algo como:

```text
DEMO_REMOTE_PUBLISH_URL=https://dls-demo-publisher.tu-cuenta.workers.dev
DEMO_REMOTE_PUBLISH_TOKEN=...
DEMO_PUBLISH_TTL_HOURS=24
```

## Conectar DLS Studio

El setup ya escribe esas variables en `.env`, que esta ignorado por Git. Despues
solo tienes que arrancar el Studio:

```powershell
npm.cmd start
```

Desde ese momento, el boton `Publicar demo` sigue usando `/api/demo-publish`,
pero tu backend sube el HTML al Worker. El navegador nunca ve el token.

## Ajustar caducidad

- `DEMO_PUBLISH_TTL_HOURS` controla lo que pide el Studio al publicador.
- `DEMO_TTL_HOURS` en el Worker actua como fallback.
- KV no acepta TTL por debajo de 60 segundos.

## Comprobar salud

```powershell
Invoke-RestMethod "https://dls-demo-publisher.tu-cuenta.workers.dev/api/health"
```

La respuesta debe incluir:

```json
{
  "ok": true,
  "service": "dls-demo-publisher",
  "storage": true
}
```

## Limites practicos

El HTML exportado de DLS se guarda en una clave KV. El Worker limita cada demo a
`DEMO_MAX_HTML_BYTES` y el valor por defecto es 14 MB. Si una web pesa mas, toca
reducir imagenes incrustadas o pasar a un storage tipo R2.

## Seguridad Cloudflare

Si expones el Worker con dominio propio, aplica tambien el runbook de fase 5:
[`CLOUDFLARE_FASE_5.md`](CLOUDFLARE_FASE_5.md). Como minimo, deja HTTPS
forzado, HSTS, WAF Managed Rules, Bot Fight Mode si hay trafico publico y rate
limiting en `POST /api/demo-publish`.
