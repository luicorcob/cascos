# Plan Google-first para LocalLift

> Estado: roadmap tecnico de referencia. No se ejecuta hasta que una prioridad
> aparezca en `docs/AHORA.md` o resuelva un bloqueo repetido de cliente.

Objetivo: conectar LocalLift con el ecosistema Google para que la web, el chatbot y el panel del negocio trabajen con datos reales: correo profesional, telefono, horarios, ubicacion, reseñas, reservas y rendimiento.

## Fuentes oficiales clave

- Google Business Profile APIs: gestion de informacion del negocio, publicaciones, reseñas, Q&A, llamadas, verificaciones, acciones y rendimiento.
- Business Information API: ubicacion, telefono, web, horarios regulares/especiales, servicios y descripcion.
- Place Actions API: enlaces de accion como reservar mesa, pedir cita, pedir comida o realizar pedidos.
- Reviews API: listar reseñas, obtener reseña concreta, responder reseñas y eliminar respuestas.
- Places API: datos publicos de lugar como `googleMapsUri`, `websiteUri`, rating, reseñas, horarios, fotos, estado y ubicacion.
- Google Calendar API: `freeBusy` para disponibilidad y `events.insert` para crear reservas/citas.
- Google Workspace Admin SDK Directory API: crear usuarios de correo profesional bajo un dominio Workspace del cliente.

## Regla clave sobre correo

No se puede crear una cuenta Gmail personal para un cliente como parte de un servicio gestionado. Lo profesional y automatizable es crear usuarios en **Google Workspace** sobre un dominio del cliente, con permisos de administrador y facturacion Workspace. El endpoint de ejemplo `/api/google/workspace/user` usa Admin SDK Directory API y empieza en `dryRun` por seguridad.

## Estrategia por fases

### Fase 1 - Google-ready sin aprobaciones complejas

Usar URLs e IDs que el cliente puede aportar manualmente:

- Email profesional deseado.
- Dominio Workspace.
- Email del gestor LocalLift autorizado.
- Google Maps URL.
- Place ID.
- Review URL.
- Appointment/reservation URL.
- Calendar ID opcional.
- Google Business Profile location ID opcional.

Impacto:

- El chatbot ya puede responder "ver reseñas", "como llegar", "reservar" y "horarios".
- La web ya enlaza correctamente a Google Maps y reseñas.
- No requiere OAuth ni aprobacion de Google Business Profile API.

### Fase 2 - Enriquecimiento con Places API

Backend consulta Places API por `placeId` para traer:

- Nombre oficial.
- Direccion.
- Telefono.
- Web.
- Google Maps URL.
- Rating.
- Numero de reseñas.
- Horarios regulares.
- Fotos.

Uso:

- Pre-rellenar el editor.
- Avisar si hay datos inconsistentes entre web y Google.
- Mostrar rating y reseñas de forma controlada.

Notas:

- Places API requiere API key y billing.
- Pedir solo campos necesarios para controlar coste.
- Guardar snapshot local para no llamar a la API en cada carga.

### Fase 3 - Reservas con Google Calendar

Backend con OAuth del negocio:

- `freeBusy`: comprobar disponibilidad en un calendario.
- `events.insert`: crear reserva/cita.
- Reglas locales: duracion por servicio, margen entre citas, horario laboral, capacidad por slot, bloqueo manual.

Flujo recomendado:

1. Cliente pregunta al chatbot: "quiero reservar mañana".
2. Bot pide servicio, fecha/hora, nombre y telefono/email.
3. Backend comprueba disponibilidad.
4. Si hay hueco, crea evento en Calendar.
5. Bot confirma y manda resumen.
6. Evento incluye origen `LocalLift`, datos del cliente y enlace de la web.

### Fase 3B - Correo profesional con Google Workspace

Con permisos de administrador del dominio:

- Crear usuario `info@`, `hola@`, `reservas@` o `citas@`.
- Forzar cambio de contraseña al primer login.
- Configurar firma, alias, recuperacion y reenvios si procede.
- Documentar que la licencia Workspace genera coste recurrente para el cliente.

Flujo recomendado:

1. Cliente compra/autoriza dominio.
2. Cliente activa Google Workspace o nos invita como admin delegado.
3. Backend valida payload en `dryRun`.
4. Se crea el usuario tras aprobacion explícita.
5. Se entrega acceso inicial y se fuerza cambio de contraseña.

### Fase 4 - Google Business Profile API

Cuando el producto tenga pilotos:

- Solicitar acceso/allowlist a APIs necesarias.
- OAuth con permisos de Business Profile.
- Sincronizar datos del negocio:
  - Telefono.
  - Horarios.
  - Web.
  - Descripcion.
  - Servicios.
  - Acciones de reserva.
  - Reseñas.
- Crear alertas de diferencias entre Google y la web.

### Fase 5 - Reseñas y reputacion

Con Reviews API:

- Listar reseñas recientes.
- Detectar reseñas sin respuesta.
- Sugerir respuesta con IA.
- Publicar respuesta solo tras aprobacion humana.
- Enviar enlace de reseña tras visita/reserva.
- Preparar mensajes con `/api/google/review-request`.

Regla importante:

- Nunca responder reseñas automaticamente sin revision del negocio al principio.

### Fase 6 - Performance y reporting

Con Business Profile Performance API y tracking propio:

- Clics en llamada.
- Clics en web.
- Clics en direccion.
- Busquedas/local discovery.
- Aperturas del chatbot.
- Leads capturados.
- Reservas creadas.
- Preguntas frecuentes del bot.

Salida:

- Reporte mensual para justificar la mensualidad.

## Arquitectura tecnica

Frontend exportado:

- No guarda claves.
- Guarda IDs/URLs publicas y configuracion del negocio.
- Habla con endpoint backend opcional.

Backend LocalLift:

- Guarda tokens OAuth cifrados.
- Llama a Google APIs.
- Llama a OpenAI para chatbot avanzado.
- Normaliza datos para el frontend.
- Registra eventos y leads.
- Ejecuta acciones sensibles en modo aprobacion: crear correo, publicar respuesta a reseña, crear reserva.

Datos por negocio:

```json
{
  "google": {
    "enabled": true,
    "workspaceEmail": "info@negocio.com",
    "workspaceDomain": "negocio.com",
    "managerEmail": "gestor@locallift.com",
    "placeId": "ChIJ...",
    "mapsUrl": "https://maps.google.com/...",
    "mapEmbedUrl": "https://www.google.com/maps?...&output=embed",
    "reviewUrl": "https://g.page/r/...",
    "reviewRequestTemplate": "Gracias por visitar {business}. Deja tu reseña aqui: {reviewUrl}",
    "appointmentUrl": "https://...",
    "bookingRules": "30 min por cita, 10 min buffer, confirmacion manual",
    "calendarId": "primary",
    "businessProfileAccountId": "",
    "businessProfileLocationId": "",
    "rating": 4.8,
    "reviewCount": 248
  }
}
```

## Roadmap recomendado

### Semana 1

- Campos Google en Studio.
- Chatbot responde con mapas, reseñas y reserva.
- Captura de leads local.
- Documentar setup manual.

### Semana 2

- Backend `examples/google-integration.example.mjs`.
- Places API: endpoint `/api/google/place`.
- Calendar API: endpoint `/api/google/availability`.
- Calendar API: endpoint `/api/google/book`.
- Review request: endpoint `/api/google/review-request`.
- Workspace user dry-run: endpoint `/api/google/workspace/user`.

### Semana 3

- OAuth real para Calendar.
- Guardar tokens por negocio.
- Lead inbox local.
- Resumen de conversaciones.

### Semana 4

- Business Profile API allowlist.
- Sincronizacion GBP -> LocalLift.
- Reputacion: listar reseñas y borradores de respuesta.
- Reporte mensual automatizado.

## Riesgos y decisiones

- Google Business Profile API puede requerir aprobacion y permisos sensibles. Por eso se empieza con Places API + URLs manuales + Calendar.
- Calendar necesita OAuth del negocio; no debe usarse una cuenta central para todos los clientes.
- Workspace necesita admin del dominio del cliente; crear usuarios puede generar costes de licencia.
- Places API tiene coste por campos. Pedir campos minimos y cachear.
- Las respuestas a reseñas deben tener aprobacion humana.
- Las reservas deben validar horario, buffers y datos de contacto.

## Fuentes oficiales

- Business Profile APIs overview: https://developers.google.com/my-business/ref_overview
- Business Information Location resource: https://developers.google.com/my-business/reference/businessinformation/rest/v1/locations
- Review data: https://developers.google.com/my-business/content/review-data
- Places API Place resource: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- Places API fields: https://developers.google.com/maps/documentation/places/web-service/data-fields
- Calendar FreeBusy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Calendar Events insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Admin SDK Users insert: https://developers.google.com/admin-sdk/directory/reference/rest/v1/users/insert
- Business Profile Account Management: https://developers.google.com/my-business/reference/accountmanagement/rest
