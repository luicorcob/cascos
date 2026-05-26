# Lanzamiento del primer piloto online

Objetivo: publicar LocalLift para que un negocio real pueda recibir leads o reservas desde una URL online y gestionarlos desde el portal.

## Resultado esperado

Al terminar el piloto debe funcionar este flujo:

1. Visitante entra en la web publica.
2. Envía un lead o solicita una reserva.
3. El contacto aparece en `pages/business-dashboard.html`.
4. El operador cambia estado, confirma reserva o guarda una nota.
5. El reporte mensual muestra conversiones, leads y reservas.

## Backend

Archivos ya preparados:

- `render.yaml`: blueprint para Render con healthcheck y disco persistente.
- `Dockerfile`: despliegue por contenedor si se usa Railway, Fly.io, VPS o similar.
- `.env.example`: plantilla de variables.
- `server/scripts/validate-deploy-env.mjs`: bloqueo de arranque inseguro en produccion.

Variables minimas en cloud:

```text
NODE_ENV=production
HOST=0.0.0.0
LOCALLIFT_ADMIN_TOKEN=<token-largo-aleatorio>
CORS_ORIGIN=https://www.tudominio.com,https://tudominio.com
BUSINESS_DB_FILE=/data/business-db.json
BUSINESS_DB_BACKUP_DIR=/data/backups
BUSINESS_DB_BACKUPS=true
```

Comprobaciones:

```text
GET https://tu-api.com/api/health
GET https://tu-api.com/api/businesses
```

La primera debe devolver `ok: true`. La segunda debe devolver `401` si no mandas el token admin.

## Frontend publico

Para el primer piloto hay dos caminos validos:

- Subir el HTML exportado del Studio a Vercel, Netlify, Cloudflare Pages o hosting del cliente.
- Servir temporalmente la web desde el mismo backend si el objetivo es solo demo controlada.

Antes de publicar:

- Poner telefono real.
- Poner WhatsApp real.
- Poner mapa real.
- Activar formulario de lead.
- Activar reservas si el negocio usa agenda.
- Comprobar que la web publica apunta a la URL del backend online.

## Portal operativo

Abrir:

```text
https://tu-api.com/pages/business-dashboard.html
```

Acciones:

- Pegar `LOCALLIFT_ADMIN_TOKEN` en la barra lateral.
- Cargar negocio.
- Revisar leads.
- Revisar reservas.
- Abrir reporte mensual imprimible.

## Prueba de aceptacion

- [ ] `/api/health` devuelve `ok: true`.
- [ ] `/api/businesses` sin token devuelve `401`.
- [ ] El portal carga con token.
- [ ] La web publica crea un lead.
- [ ] La web publica crea una reserva si hay agenda activa.
- [ ] El dashboard muestra lead/reserva.
- [ ] Se puede cambiar estado de lead.
- [ ] Se puede confirmar/cancelar reserva.
- [ ] El reporte mensual recoge eventos.
- [ ] El negocio entiende el dashboard sin explicacion larga.

## Datos del piloto

Registrar antes de venderlo como caso:

- Nombre del negocio.
- Sector.
- Ciudad.
- URL publica.
- URL del portal.
- Fecha de publicacion.
- Objetivo principal: llamadas, WhatsApp, reservas, leads o pedidos.
- Resultado semanal: leads, reservas, conversiones, ventas si aplica.

## Criterio para pasar al siguiente piloto

El primer piloto se considera valido si durante 7 dias:

- No se pierden leads.
- No se duplican reservas.
- El negocio puede usar el dashboard con ayuda minima.
- El reporte mensual o semanal permite explicar valor con datos.
