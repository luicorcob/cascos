# Guia de despliegue inicial

Esta guia deja LocalLift Studio listo para pasar de demo local a piloto online. La web exportada puede vivir en hosting estatico, pero las funciones operativas necesitan un backend Node activo.

## Que necesita servidor

Funciona solo como HTML estatico:

- Web publica exportada.
- Chatbot local sin IA externa.
- Formulario de lead con respaldo en navegador.
- Widget de reserva con respaldo local.
- Galeria, mapa, CTA, FAQ, tienda visual y tracking en memoria.

Necesita backend encendido:

- Guardado multi-negocio en `data/business-db.json`.
- CRM real de leads, clientes y actividades.
- Reservas reales con validacion de disponibilidad.
- Bloqueos de agenda, recordatorios y reporte mensual.
- Tracking persistente de conversiones.
- IA real, pagos, emails, Google Calendar, Google Business Profile y Workspace.

En local lo mantiene vivo `npm.cmd start`. En produccion lo mantiene vivo la plataforma de hosting, igual que cualquier API.

## Arquitectura recomendada MVP

Opcion rapida:

- Frontend: Vercel, Netlify, Cloudflare Pages o hosting estatico del cliente.
- Backend Node: Render, Railway, Fly.io, VPS o similar.
- Dominio: `www.cliente.com` para la web y `api.cliente.com` o `api.tuempresa.com` para la API.
- Healthcheck: `GET https://api.tuempresa.com/api/health`.

Deploy directo desde GitHub:

```text
https://render.com/deploy?repo=https://github.com/luicorcob/cascos
```

El repositorio ya incluye `render.yaml` para crear un servicio web Node en Render con:

- `startCommand: npm run start:prod`
- `healthCheckPath: /api/health`
- plan `starter` y disco persistente montado en `/data`
- `BUSINESS_DB_FILE=/data/business-db.json`
- secretos `LOCALLIFT_ADMIN_TOKEN` y `CORS_ORIGIN` pendientes de rellenar en la plataforma

Render solo permite adjuntar discos persistentes a servicios de pago. No cambies el Blueprint a plan gratuito mientras el backend use archivos JSON para guardar datos reales.

Tambien incluye `Dockerfile` para proveedores basados en contenedor.

## Frontend separado de la API

Si publicas la web o el dashboard en Vercel, Netlify o Cloudflare Pages y la API en Render/Railway, configura la URL base de API de una de estas formas:

```text
https://www.cliente.com/pages/business-dashboard.html?apiBase=https://tu-api.onrender.com
```

Al abrir con `apiBase`, LocalLift guarda esa URL en `localStorage` para ese navegador. Tambien puedes pegarla en el campo `URL API` del dashboard.

Orden de prioridad:

1. `window.LOCALLIFT_API_BASE`
2. `<meta name="locallift-api-base" content="https://tu-api.com">`
3. `localStorage.locallift_api_base`
4. mismo dominio

Cuando exportas una web desde el Studio y tienes `apiBase` configurado, el HTML exportado incluye el meta `locallift-api-base`. Asi el formulario de lead, reservas y eventos pueden apuntar al backend online aunque la web viva en otro hosting.

URLs utiles:

```text
https://www.cliente.com/?apiBase=https://tu-api.onrender.com
https://www.cliente.com/pages/business-dashboard.html?apiBase=https://tu-api.onrender.com
https://www.cliente.com/pages/monthly-report.html?business=brasa-norte&apiBase=https://tu-api.onrender.com
```

Opcion mas profesional:

- Frontend multi-cliente servido desde CDN.
- Backend Node persistente.
- Base de datos Postgres/Supabase.
- Storage para imagenes en Cloudinary, Supabase Storage o S3.
- Cola de trabajos para recordatorios, emails e integraciones.

## Variables de entorno

Minimas para el servidor principal:

```powershell
$env:PORT="5173"
$env:HOST="0.0.0.0"
$env:LOCALLIFT_ADMIN_TOKEN="usa-un-token-largo-aleatorio"
$env:CORS_ORIGIN="https://www.cliente.com,https://cliente.com"
$env:BUSINESS_DB_FILE="data/business-db.json"
$env:BUSINESS_DB_BACKUPS="true"
npm.cmd start
```

En plataformas cloud, `PORT` suele venir definido automaticamente. Usa `HOST=0.0.0.0` cuando el proveedor lo requiera para exponer el servicio fuera del contenedor.

`LOCALLIFT_ADMIN_TOKEN` protege las rutas administrativas `/api/businesses/*`. Si no se define, el servidor mantiene el modo local abierto para desarrollo. En produccion debe estar definido y el portal `pages/business-dashboard.html` permite guardarlo en el navegador desde la barra lateral.

`CORS_ORIGIN` limita que dominios pueden llamar a la API desde navegador. En desarrollo puede omitirse para usar `*`; en produccion pon los dominios reales del frontend, separados por comas si hay mas de uno. El servidor devolvera el origen permitido que coincida con la peticion.

El archivo `.env.example` resume las variables principales para copiar la configuracion a Render, Railway, Fly.io o un VPS.

Antes de arrancar en produccion:

```powershell
$env:NODE_ENV="production"
$env:HOST="0.0.0.0"
$env:LOCALLIFT_ADMIN_TOKEN="usa-un-token-largo-aleatorio-de-32-caracteres"
$env:CORS_ORIGIN="https://www.cliente.com,https://cliente.com"
$env:BUSINESS_DB_FILE="data/business-db.json"
npm.cmd run check:deploy
```

`npm run start:prod` ejecuta esta validacion antes de levantar el servidor. Si falta token admin, CORS HTTPS o base persistente, el arranque falla a proposito.

Para tienda y pagos, el ejemplo `examples/commerce-api.example.mjs` necesita:

```text
STORE_ADMIN_TOKEN
CORS_ORIGIN
CHECKOUT_ALLOWED_ORIGINS
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ORDER_EMAIL_TO
RESEND_API_KEY
```

Para IA y Google, mantener claves y tokens siempre en backend:

```text
OPENAI_API_KEY
OPENAI_MODEL
GOOGLE_MAPS_API_KEY
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI
GOOGLE_TOKEN_ENCRYPTION_KEY
GOOGLE_AUTH_DB_FILE
GOOGLE_CALENDAR_ID
```

Los siguientes tokens globales solo existen para migrar el antiguo backend de
ejemplo y no deben usarse con nuevos clientes:

```text
GOOGLE_CALENDAR_ACCESS_TOKEN
GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN
GOOGLE_WORKSPACE_ADMIN_ACCESS_TOKEN
```

La guia completa de alta y consentimiento esta en
[`GOOGLE_CLOUD_SETUP.md`](GOOGLE_CLOUD_SETUP.md). Antes de conectar una cuenta:

```powershell
npm.cmd run google:check
npm.cmd run test:google
```

## Healthcheck

El servidor principal expone:

```text
GET /api/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "service": "locallift-studio",
  "environment": "production",
  "database": {
    "readable": true,
    "writable": true
  },
  "counts": {
    "businesses": 1,
    "contacts": 0,
    "bookings": 0
  }
}
```

Usalo en Render/Railway/Fly/VPS para saber si la API esta levantada y si puede leer/escribir la base JSON.

## Nota sobre la base JSON

`data/business-db.json` esta bien para demo, desarrollo y pilotos controlados. Para vender a varios clientes en serio, el siguiente salto es Postgres o Supabase:

- Evita conflictos de escritura concurrente.
- Permite usuarios, permisos y auditoria por cliente.
- Facilita backups, busquedas y metricas historicas.
- Mejora despliegues sin depender del disco local del servidor.

## Checklist antes del primer piloto online

- [ ] Publicar frontend en dominio real.
- [ ] Publicar backend Node con HTTPS.
- [ ] Definir `LOCALLIFT_ADMIN_TOKEN` en el backend.
- [ ] Configurar `CORS_ORIGIN` con dominios reales del frontend.
- [ ] Comprobar `GET /api/health`.
- [ ] Crear un negocio de prueba desde el Studio.
- [ ] Probar lead publico, reserva publica y reporte mensual.
- [ ] Activar logs/backups del proveedor.
- [ ] Preparar migracion a Postgres/Supabase si hay mas de 3-5 clientes activos.

La guia operativa del primer piloto esta en `docs/operaciones/PILOT_LAUNCH.md`.
