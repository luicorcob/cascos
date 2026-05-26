# Plan maestro de digitalizacion total para negocios locales

Fecha de referencia: 2026-05-25

Objetivo: convertir LocalLift Studio en una plataforma operativa completa para negocios pequenos: web, ventas, reservas, clientes, marketing, reputacion, pagos, automatizaciones y gestion diaria. La meta no es copiar un ERP pesado, sino ofrecer el 80-90% del valor real que necesita un negocio local con una experiencia mucho mas simple, rapida y barata.

## 1. Vision ejecutiva

LocalLift debe evolucionar de "generador de webs premium" a "sistema operativo sencillo para negocios locales".

El cliente ideal no quiere aprender Odoo, configurar Shopify, pelearse con plugins de WordPress ni pagar consultoria cada vez que cambia un horario. Quiere que su negocio este digitalizado, venda mas, responda mejor y parezca profesional desde el movil.

La propuesta debe ser:

> Te montamos y mantenemos todo lo digital de tu negocio: web, Google, reservas, clientes, pagos, tienda, mensajes, reputacion y reportes. Simple, barato y sin complicarte.

## 2. Ambicion competitiva

### Contra Odoo

Odoo es muy potente, modular y extensible. Su debilidad para negocios pequenos es la complejidad: demasiadas apps, configuracion, curva de aprendizaje y coste indirecto de implantacion.

LocalLift debe ganar con:

- Menos pantallas.
- Menos configuracion.
- Onboarding guiado por sector.
- Entrega hecha por nosotros.
- Automatizaciones ya preparadas.
- Plantillas verticales para restaurante, clinica, peluqueria, gimnasio, tienda, taller, academia y servicios.
- Precio inicial bajo.
- Mantenimiento humano + IA.

### Contra Shopify/Square

Shopify y Square son fuertes en comercio, pagos y POS. Su punto debil para muchos negocios locales es que no cubren toda la presencia local, reputacion, Google, reservas, contenido y servicio al cliente de forma integrada para negocios pequenos no puramente ecommerce.

LocalLift debe ganar con:

- Web local + tienda + reservas + chatbot en un unico flujo.
- Conversion movil primero.
- Google Business Profile como parte central, no como accesorio.
- Operacion local: llamadas, WhatsApp, mapas, resenas, horarios, fotos y promociones.

### Contra Zoho

Zoho ofrece muchas aplicaciones empresariales. Su punto debil es que el negocio pequeno no sabe cuales necesita ni como conectarlas.

LocalLift debe ganar con:

- Una interfaz unica.
- Modulos preseleccionados por sector.
- Reportes en lenguaje simple.
- Automatizaciones de bajo mantenimiento.
- Implementacion rapida.

## 3. Principios de producto

1. Movil primero.
   Todo lo importante debe poder gestionarse desde telefono: revisar leads, confirmar reserva, ver pedido, responder mensaje, cambiar horario y lanzar promocion.

2. Un click siempre que sea posible.
   Cambios visuales, textos, colores, secciones, horarios, promociones, metodos de contacto y llamadas a la accion deben tener presets.

3. Cero configuracion tecnica para el cliente.
   El cliente no debe pensar en APIs, DNS, webhooks, schema, hosting, SEO tecnico ni seguridad.

4. Datos reutilizables.
   Cada dato del negocio debe alimentar web, chatbot, tienda, Google, reportes, emails, presupuestos y automatizaciones.

5. Verticalizacion por sector.
   No vender "software generico". Vender paquetes claros: restaurante, clinica, peluqueria, gimnasio, academia, taller, tienda local, servicios profesionales.

6. Barato sin parecer barato.
   Interfaz cuidada, outputs premium, entregas profesionales, pero arquitectura de coste bajo.

7. No construir un ERP monstruoso.
   El sistema debe resolver las tareas diarias mas valiosas, no replicar todos los menus de un ERP grande.

8. Portable y honesto.
   Exportar datos, exportar web, backups, claridad en limites. Eso genera confianza.

## 4. Estado actual del proyecto

LocalLift ya tiene una buena base:

- Editor de negocio.
- Vista previa desktop, tablet y movil.
- Exportacion HTML standalone.
- Plantillas/demo por sector.
- Personalizacion visual.
- Tienda online basica.
- Checkout Stripe en backend de ejemplo.
- Panel admin de tienda.
- Chatbot local configurable.
- Endpoint IA opcional.
- Google Ops.
- Onboarding.
- Documentacion comercial y tecnica inicial.

Lo que falta para llegar a "digitalizacion completa":

- Multi-cliente real.
- Base de datos de clientes/leads.
- Agenda y reservas reales.
- Bandeja de mensajes.
- Historial de actividad por cliente.
- Automatizaciones configurables.
- Reportes mensuales.
- Facturas/presupuestos.
- Inventario mas serio.
- Roles y permisos.
- Backups.
- Integraciones productivas con Google/Stripe/email/WhatsApp.
- Portal simple para que el negocio gestione su dia a dia.

## 5. Producto objetivo

La plataforma final debe tener 3 capas:

### 5.1 Studio interno

Uso: equipo LocalLift.

Sirve para crear, personalizar, revisar y entregar negocios.

Debe incluir:

- Lista de negocios.
- Crear negocio desde plantilla.
- Importar datos desde formulario.
- Editor visual avanzado.
- Score de entrega.
- Checklist por sector.
- Exportar web.
- Publicar web.
- Ver estado de integraciones.
- Generar brief del cliente.
- Generar reporte mensual.

### 5.2 Portal del negocio

Uso: dueno o equipo del negocio.

Sirve para operar el dia a dia.

Debe incluir:

- Dashboard simple.
- Leads.
- Clientes.
- Reservas.
- Pedidos.
- Productos.
- Mensajes.
- Campanas.
- Resenas.
- Reportes.
- Ajustes basicos: horarios, telefono, enlaces, fotos, servicios.

### 5.3 Web publica del negocio

Uso: visitantes/clientes finales.

Debe incluir:

- Web premium responsive.
- CTA claro: llamar, WhatsApp, reservar, comprar, llegar.
- Chatbot.
- Formulario de lead.
- Tienda o catalogo si aplica.
- Reservas si aplica.
- FAQ.
- Resenas.
- Mapa.
- Eventos de analitica.

## 6. Modulos necesarios

## 6.1 Multi-cliente y base de negocios

### Objetivo

Gestionar muchos negocios desde una sola instalacion.

### Funciones

- Crear negocio.
- Duplicar negocio.
- Archivar negocio.
- Buscar por nombre, sector, ciudad, estado o plan.
- Estado de implantacion: lead, onboarding, en diseno, en revision, publicado, mantenimiento, pausado.
- Estado de salud: web activa, pagos activos, reservas activas, Google conectado, ultimo backup, ultimo reporte.

### Datos minimos

- `business.id`
- `business.name`
- `business.slug`
- `business.category`
- `business.city`
- `business.ownerName`
- `business.ownerEmail`
- `business.ownerPhone`
- `business.plan`
- `business.status`
- `business.createdAt`
- `business.updatedAt`
- `business.publishedUrl`
- `business.integrations`
- `business.brand`
- `business.settings`

### Pantallas

- Lista de negocios.
- Ficha del negocio.
- Timeline de implantacion.
- Panel de acciones rapidas.

### Criterios de aceptacion

- Se puede crear un negocio nuevo sin tocar codigo.
- Se puede cargar una demo existente y convertirla en negocio real.
- Se puede guardar y recuperar el negocio desde backend.
- Se puede filtrar por estado y sector.
- La ficha muestra que falta para poder entregar.

## 6.2 Onboarding inteligente

### Objetivo

Recoger toda la informacion del cliente sin llamadas largas ni documentos desordenados.

### Funciones

- Formulario por sector.
- Subida de fotos.
- Servicios y precios.
- Horarios.
- Ubicacion.
- Enlaces.
- Redes sociales.
- Preguntas frecuentes.
- Competidores/referencias.
- Tono de marca.
- Objetivo principal: reservas, llamadas, pedidos, visitas, leads.
- Checklist de materiales pendientes.

### Flujo

1. LocalLift crea negocio.
2. Sistema genera enlace de onboarding.
3. Cliente rellena formulario.
4. Sistema valida campos.
5. Sistema genera brief interno.
6. Studio crea primera version automaticamente.

### Automatizaciones

- Recordatorio si faltan fotos.
- Recordatorio si falta enlace de reservas.
- Aviso interno cuando el cliente completa el onboarding.
- Generacion de textos iniciales con IA en una fase posterior.

### Criterios de aceptacion

- El cliente puede completar el onboarding desde movil.
- El sistema marca campos faltantes.
- El contenido se importa al editor sin copiar y pegar manual.
- Se genera un resumen claro para el equipo.

## 6.3 Motor web y personalizacion avanzada

### Objetivo

Que el cliente vea cambios profesionales en un click: letras, colores, dimensiones, densidad, estructura, imagenes y CTA.

### Funciones

- Packs visuales por sector.
- Packs de conversion: reservas, llamadas, WhatsApp, tienda, confianza, urgencia.
- Controles de color.
- Controles de tipografia.
- Escala de espaciado.
- Escala de imagenes.
- Forma de imagenes.
- Alto del hero.
- Ancho de contenido.
- Reordenar secciones.
- Activar/desactivar secciones.
- Galeria responsive robusta.
- Vista previa movil como modo principal.

### Tareas concretas

- Separar el motor de render en modulos: datos, validacion, templates, estilos, exportacion.
- Crear presets de marca por sector.
- Crear preset "mobile first" para negocios que dependen de llamadas/WhatsApp.
- Crear preset "catalogo rapido" para tiendas.
- Crear preset "reservas premium" para clinicas, belleza y restaurantes.
- Crear preset "servicio urgente" para talleres, cerrajeria, reformas y reparaciones.
- Crear inspector de secciones para cambiar orden y visibilidad.

### Criterios de aceptacion

- Un cliente puede ver 5 cambios visuales notables en menos de 30 segundos.
- La web exportada se ve bien en 360px, 768px, 1366px y 1920px.
- Las imagenes no se deforman ni rompen el layout.
- La galeria movil tiene scroll natural y no tapa contenido.
- No aparece texto `undefined` en ningun estado.

## 6.4 CRM ligero

### Objetivo

Centralizar leads y clientes sin obligar al negocio a usar un CRM complejo.

### Funciones

- Leads entrantes desde web, chatbot, formulario, WhatsApp manual y tienda.
- Clientes convertidos.
- Estados: nuevo, contactado, esperando respuesta, reservado, ganado, perdido.
- Notas.
- Tareas.
- Etiquetas.
- Historial de interacciones.
- Recordatorios.
- Valor estimado.
- Fuente: web, Google, Instagram, referido, tienda, manual.

### Datos minimos

- `contact.id`
- `contact.businessId`
- `contact.type`: lead/customer
- `contact.name`
- `contact.phone`
- `contact.email`
- `contact.source`
- `contact.status`
- `contact.tags`
- `contact.notes`
- `contact.lastInteractionAt`
- `contact.createdAt`

### Pantallas

- Pipeline simple.
- Tabla de contactos.
- Ficha de contacto.
- Crear tarea.
- Historial.

### Automatizaciones

- Crear lead cuando llega formulario.
- Crear tarea si un lead no se responde en 24 horas.
- Marcar como cliente si completa compra o reserva.
- Enviar mensaje de seguimiento tras cita o pedido.

### Criterios de aceptacion

- Todo lead queda guardado.
- El dueno puede cambiar estado con un click.
- El sistema muestra leads sin respuesta.
- Se puede exportar CSV.

## 6.5 Bandeja de mensajes

### Objetivo

Reducir el caos de mensajes dispersos.

### Canales iniciales

- Formulario web.
- Chatbot.
- Email transaccional.
- WhatsApp mediante enlace en primera fase.

### Canales futuros

- WhatsApp Business API.
- Instagram DM.
- Facebook Messenger.
- Google Business messages si esta disponible y encaja.

### Funciones

- Inbox por negocio.
- Conversacion por contacto.
- Respuestas rapidas.
- Plantillas por sector.
- Asignacion a usuario.
- Estado: abierto, pendiente, cerrado.
- Resumen IA de conversacion en fase posterior.

### Criterios de aceptacion

- Cada lead del chatbot aparece en la bandeja.
- Se puede responder o marcar como gestionado.
- Hay filtros por abierto, pendiente y cerrado.
- El historial queda unido al contacto.

## 6.6 Reservas y agenda

### Objetivo

Permitir que negocios con citas trabajen sin herramientas externas caras.

### Sectores prioritarios

- Peluquerias.
- Barberias.
- Clinicas.
- Fisioterapia.
- Gimnasios/clases.
- Restaurantes con reserva.
- Academias.
- Servicios profesionales.

### Funciones MVP

- [x] Servicios reservables.
- [x] Duracion por servicio.
- [x] Horarios disponibles.
- [x] Bloqueos manuales.
- [x] Crear reserva.
- [x] Confirmar/cancelar reserva.
- [x] Recordatorio manual.
- [x] Vista calendario semanal.
- [x] Cola de recordatorios automaticos en dry-run.
- [ ] Envio automatico real.

### Funciones avanzadas

- Empleados/recursos.
- Deposito o prepago.
- Politica de cancelacion.
- Lista de espera.
- Sincronizacion Google Calendar.
- Confirmacion por WhatsApp/email.

### Datos minimos

- `service.id`
- `service.durationMinutes`
- `service.price`
- `staff.id`
- `availability.weekday`
- `availability.startTime`
- `availability.endTime`
- `bookingBlock.startsAt`
- `bookingBlock.endsAt`
- `booking.id`
- `booking.contactId`
- `booking.serviceId`
- `booking.startsAt`
- `booking.endsAt`
- `booking.status`
- `bookingReminder.bookingId`
- `bookingReminder.channel`
- `bookingReminder.message`
- `bookingReminder.source`

### Criterios de aceptacion

- Un visitante puede reservar desde movil en menos de 60 segundos.
- El negocio ve reservas del dia.
- No se crean reservas duplicadas en el mismo slot.
- No se crean reservas fuera de horario ni en bloqueos manuales.
- Un operador puede preparar recordatorio WhatsApp/email desde la reserva.
- Un operador puede preparar en lote recordatorios proximos sin envio automatico.
- Se puede cancelar y liberar hueco.

## 6.7 Tienda, pedidos e inventario

### Objetivo

Dar una tienda ligera para negocios locales sin necesidad de Shopify.

### Funciones actuales a consolidar

- Productos.
- Precios.
- Imagenes.
- Stock.
- Carrito.
- Checkout Stripe.
- Pedidos.
- Cupones.
- Admin.

### Mejoras necesarias

- Variantes: talla, color, sabor, formato.
- Categorias.
- Busqueda.
- Productos destacados.
- Stock bajo.
- Recogida en tienda.
- Envio local.
- Horario de preparacion.
- Impuestos configurables.
- Estados de pedido claros.
- Notificacion interna.
- Email de confirmacion.

### Funciones POS ligero

- Venta rapida desde panel.
- Buscar producto.
- Ajustar cantidad.
- Cobrar fuera de linea o Stripe Terminal en fase futura.
- Recibo.
- Cierre diario basico.

### Criterios de aceptacion

- El negocio puede crear producto desde el panel.
- El cliente puede comprar desde movil.
- El stock se descuenta al confirmar pago.
- El negocio ve pedidos nuevos en tiempo real o con refresco claro.
- Se puede marcar pedido como preparado, entregado o cancelado.

## 6.8 Presupuestos, facturas y pagos

### Objetivo

Cubrir servicios que no venden productos simples: reformas, talleres, clinicas, academias, consultores.

### Funciones MVP

- Crear presupuesto.
- Convertir presupuesto en factura.
- Enviar enlace de pago.
- Marcar pagado manualmente.
- Descargar PDF.
- Numeracion basica.
- Datos fiscales del negocio.

### Funciones futuras

- Factura recurrente.
- Suscripciones.
- Pagos parciales.
- Recordatorios de pago.
- Integracion contable.
- Exportacion para gestor.

### Criterios de aceptacion

- Se puede crear un presupuesto en menos de 2 minutos.
- El PDF tiene imagen profesional.
- El estado cambia de borrador a enviado, aceptado, pagado o vencido.
- Los importes cuadran con impuestos y descuentos.

## 6.9 Marketing local

### Objetivo

Ayudar al negocio a vender y volver a contactar sin contratar una agencia completa.

### Funciones MVP

- Campanas simples.
- Promociones por fecha.
- Cupones.
- Banners en web.
- Emails basicos.
- Publicaciones sugeridas para Google/Instagram.
- Segmentos: clientes nuevos, clientes inactivos, compradores, reservas recientes.

### Automatizaciones clave

- Despues de compra: pedir resena.
- Despues de reserva: enviar gracias + proxima cita.
- Cliente inactivo 60 dias: promocion de retorno.
- Cumpleanos si se conoce: mensaje con oferta.
- Carrito abandonado si hay email/telefono.

### Criterios de aceptacion

- Se puede lanzar promocion en web con un click.
- Se puede crear campana para un segmento.
- El sistema registra envios y resultados basicos.
- No se envia nada sin consentimiento cuando sea necesario.

## 6.10 Reputacion y resenas

### Objetivo

Mejorar confianza y SEO local.

### Funciones

- Guardar enlace de resenas.
- Solicitar resena tras compra/reserva.
- Ver solicitudes enviadas.
- Registrar resenas destacadas manualmente.
- Mostrar mejores resenas en web.
- Alertar si hay mala resena registrada manualmente o importada en fase futura.

### Criterios de aceptacion

- El negocio puede enviar enlace de resena en 1 click.
- La web muestra testimonios reales o aprobados.
- El reporte mensual incluye solicitudes de resena y resenas nuevas si se integran.

## 6.11 Google Ops y SEO local

### Objetivo

Hacer que la presencia en Google sea parte del producto, no un extra.

### Funciones MVP

- Checklist Google Business Profile.
- Datos NAP: name, address, phone.
- Horarios.
- Enlaces.
- Fotos.
- Mapa.
- Schema LocalBusiness.
- Meta title/description.
- Sitemap en fase de publicacion.

### Funciones futuras

- Conexion Google Business Profile API si se obtiene acceso.
- Sincronizar horarios.
- Subir fotos.
- Publicar posts.
- Leer resenas.
- Reportar llamadas/clicks si API lo permite.

### Criterios de aceptacion

- Cada web exportada incluye SEO tecnico basico.
- Los datos de Google coinciden con la web.
- El checklist indica exactamente que falta.

## 6.12 Analitica y reportes

### Objetivo

Demostrar valor mensual al cliente.

### Eventos clave

- Visita web.
- Click telefono.
- Click WhatsApp.
- Click mapa.
- Click reserva.
- Apertura chatbot.
- Lead creado.
- Pedido iniciado.
- Pedido pagado.
- Solicitud de resena enviada.

### Dashboard

- Contactos nuevos.
- Reservas.
- Pedidos.
- Ventas.
- Conversiones.
- Embudo operativo.
- Recordatorios preparados.
- Top preguntas del chatbot.
- Fuentes.
- Dispositivo.
- Evolucion mensual.

### Reporte mensual

Debe ser entendible por un dueno de negocio:

- "Este mes recibiste X contactos nuevos".
- "La accion mas usada fue WhatsApp".
- "Tus clientes preguntan mucho por horario/precio/reservas".
- "Recomendacion: subir 5 fotos nuevas y activar promocion".

### Criterios de aceptacion

- El sistema registra eventos sin romper la web exportada.
- El reporte se puede generar desde el panel.
- Hay resumen mensual en el panel.
- Hay version HTML imprimible.
- Hay exportacion PDF pendiente.
- El reporte incluye acciones recomendadas.

## 6.13 Chatbot e IA operativa

### Objetivo

Responder preguntas frecuentes, capturar leads y ahorrar tiempo.

### Fase 1: bot local

- Responde con datos del negocio.
- Muestra servicios, horarios, ubicacion y enlaces.
- Captura lead.
- Deriva a WhatsApp/email.

### Fase 2: IA con base de conocimiento

- Endpoint IA por negocio.
- FAQ ampliada.
- Tono configurable.
- Limites de seguridad.
- Registro de conversaciones.
- Resumen de lead.

### Fase 3: agente operativo

- Crear reserva si hay agenda.
- Consultar pedido.
- Recomendar producto.
- Preparar presupuesto borrador.
- Sugerir respuesta al dueno.

### Criterios de aceptacion

- El bot nunca inventa datos criticos como precio cerrado, diagnostico medico o disponibilidad real si no existe.
- Si no sabe, deriva a humano.
- Toda captura de lead queda guardada.
- Las respuestas respetan tono y datos del negocio.

## 6.14 Portal del cliente final

### Objetivo

Permitir a clientes del negocio consultar sus reservas, pedidos o pagos.

### Funciones futuras

- Ver reserva.
- Cancelar o modificar si se permite.
- Ver pedido.
- Pagar factura.
- Descargar recibo.
- Actualizar datos.

### Criterios de aceptacion

- Acceso por enlace seguro o codigo.
- No requiere que el cliente final cree cuenta compleja.
- Solo muestra datos del cliente correcto.

## 6.15 Roles, permisos y seguridad

### Objetivo

Evitar errores y proteger datos.

### Roles

- Admin LocalLift.
- Operador LocalLift.
- Dueno negocio.
- Empleado negocio.
- Contable/gestor.

### Permisos basicos

- Ver dashboard.
- Editar web.
- Gestionar leads.
- Gestionar reservas.
- Gestionar productos.
- Gestionar pedidos.
- Gestionar facturacion.
- Ver reportes.
- Gestionar integraciones.

### Seguridad minima

- Autenticacion.
- Sesiones seguras.
- Hash de contrasenas.
- Tokens admin largos.
- Rate limit.
- Validacion de input.
- Backups.
- Logs de acciones importantes.
- Separacion de datos por negocio.

### Criterios de aceptacion

- Un negocio no puede ver datos de otro.
- Un empleado no puede cambiar ajustes criticos si no tiene permiso.
- Las acciones importantes quedan registradas.

## 6.16 Integraciones

### Prioridad alta

- Stripe: pagos, checkout, recibos.
- Google Calendar: reservas.
- Google Maps: ubicacion.
- Google Business Profile: cuando sea viable.
- Email transaccional: Resend, Brevo o similar.
- WhatsApp: enlace primero, API despues.
- Cloudinary/S3/Supabase Storage: imagenes.

### Prioridad media

- Meta Pixel.
- Google Analytics.
- Google Search Console.
- Zapier/Make.
- Calendly import/export.

### Prioridad futura

- Facturacion local avanzada.
- TPV fisico.
- Contabilidad.
- Proveedores.
- Marketplace de extensiones.

## 7. Arquitectura recomendada

## 7.1 Fase actual

Mantener:

- `index.html`
- `src/app.js`
- `src/styles.css`
- `pages/`
- `server/server.mjs`
- `examples/`
- `data/`
- `docs/`

## 7.2 Siguiente estructura profesional

Evolucionar gradualmente hacia:

```text
src/
  studio/
    app.js
    render/
    state/
    export/
  business/
    dashboard.js
    crm.js
    bookings.js
    commerce.js
    reports.js
  shared/
    api-client.js
    validation.js
    formatting.js
    constants.js
  styles/
    studio.css
    business.css
    shared.css
server/
  server.mjs
  api/
    business-api.mjs
    auth-api.mjs
    commerce-api.mjs
    bookings-api.mjs
    reports-api.mjs
  lib/
    db.mjs
    validation.mjs
    security.mjs
    events.mjs
    mailer.mjs
data/
  tenants/
  backups/
  business-db.example.json
docs/
tests/
```

## 7.3 Base de datos

### Paso 1: JSON bien estructurado

Usar JSON mientras el producto todavia cambia rapido.

Ventajas:

- Rapido.
- Barato.
- Facil de inspeccionar.
- Facil de exportar.

Limitaciones:

- No ideal para concurrencia.
- No ideal para muchos negocios.
- No ideal para consultas complejas.

### Paso 2: SQLite

Migrar a SQLite cuando haya CRM, reservas y pedidos reales.

Ventajas:

- Barato.
- Portable.
- Suficiente para muchos clientes pequenos.
- Backups simples.
- Puede correr en VPS barato.

### Paso 3: Postgres

Solo cuando haga falta multiusuario serio, gran volumen o despliegue cloud escalado.

## 8. Modelo de datos maestro

Entidades principales:

- `business`: negocio.
- `user`: usuario.
- `role`: rol.
- `contact`: lead o cliente.
- `activity`: evento humano o automatico.
- `task`: tarea.
- `message`: mensaje.
- `conversation`: hilo de mensajes.
- `service`: servicio.
- `staff`: empleado/recurso.
- `booking`: reserva.
- `product`: producto.
- `inventoryMovement`: movimiento de stock.
- `order`: pedido.
- `payment`: pago.
- `quote`: presupuesto.
- `invoice`: factura.
- `campaign`: campana.
- `automation`: regla automatica.
- `reviewRequest`: solicitud de resena.
- `metricEvent`: evento de analitica.
- `integration`: conexion externa.
- `asset`: imagen/documento.
- `report`: reporte mensual.

Regla importante: casi todo debe tener `businessId`. Esa es la clave para separar datos por negocio.

## 9. Roadmap por fases

## Fase 0 - Base estable y documentada

Objetivo: dejar el proyecto limpio, entendible y preparado.

Estado: parcialmente hecho.

Tareas pendientes:

- [ ] Revisar README para que la ruta de cada modulo este clara.
- [ ] Crear documento maestro de producto.
- [ ] Crear convenciones de codigo.
- [ ] Crear convenciones de datos.
- [ ] Crear lista de bugs conocidos.
- [ ] Crear checklist de QA responsive.
- [ ] Asegurar que `npm.cmd run check` pase siempre.

Entregable:

- Documentacion completa y repositorio ordenado.

## Fase 1 - Backend multi-negocio minimo

Objetivo: dejar de depender solo de localStorage y archivos demo.

Tareas:

- [x] Crear `server/api/business-api.mjs`.
- [x] Crear `server/lib/json-store.mjs`.
- [x] Crear `data/business-db.example.json`.
- [x] Endpoints:
  - `GET /api/businesses`
  - `POST /api/businesses`
  - `GET /api/businesses/:id`
  - `PUT /api/businesses/:id`
  - `DELETE /api/businesses/:id/archive`
- [x] Validar campos obligatorios.
- [x] Escritura atomica.
- [x] Backup automatico antes de cambios importantes.
- [x] Script para cargar demo inicial.

Criterios de aceptacion:

- [x] Se puede crear negocio desde API.
- [x] Se puede listar y editar.
- [x] No se corrompe JSON si falla una escritura.
- [x] El frontend puede cargar un negocio desde API.

## Fase 2 - Panel de operaciones del negocio

Objetivo: crear el primer portal diario del negocio.

Estado: implementacion inicial hecha el 2026-05-25.

Tareas:

- [x] Crear `pages/business-dashboard.html`.
- [x] Crear `src/business/dashboard.js`.
- [x] Crear `src/styles/business.css`.
- [x] Dashboard con:
  - leads nuevos
  - reservas de hoy
  - pedidos pendientes
  - ventas del mes
  - acciones rapidas
- [x] Navegacion por tabs:
  - Inicio
  - Leads
  - Clientes
  - Reservas
  - Pedidos
  - Productos
  - Reportes
  - Ajustes
- [x] Cargar datos desde API.
- [x] Estado vacio profesional.
- [x] Diseno responsive.

Criterios de aceptacion:

- El dueno puede entrar y entender que hacer en 10 segundos.
- En movil se puede consultar leads y pedidos.
- Cada tab tiene estado vacio, carga y error.

## Fase 3 - CRM y leads reales

Objetivo: que ningun contacto se pierda.

Estado: implementacion inicial hecha el 2026-05-25.

Tareas:

- [x] Crear modelo `contacts`.
- [x] Crear modelo `activities`.
- [x] Crear endpoint de leads publicos:
  - `POST /api/public/:businessSlug/leads`
- [x] Crear endpoints admin:
  - `GET /api/businesses/:id/contacts`
  - `POST /api/businesses/:id/contacts`
  - `PATCH /api/businesses/:id/contacts/:contactId`
  - `POST /api/businesses/:id/contacts/:contactId/activities`
- [x] Conectar formulario web generado.
- [x] Conectar chatbot.
- [x] Crear pipeline visual simple.
- [x] Crear notas y tareas.

Criterios de aceptacion:

- Un formulario crea un lead real.
- El chatbot crea lead real.
- El negocio cambia estado de lead.
- Hay historial por contacto.

## Fase 4 - Reservas

Objetivo: que negocios de cita puedan operar sin herramienta externa.

Estado: MVP backend + dashboard hecho el 2026-05-25.

Tareas:

- [x] Crear servicios reservables.
- [ ] Crear disponibilidad semanal.
- [ ] Crear bloqueos.
- [x] Crear reservas.
- [ ] Vista calendario.
- [x] Widget publico de reserva visible en la web generada.
- [ ] Confirmacion email.
- [x] Cancelacion.
- [x] Evitar doble reserva.

Criterios de aceptacion:

- Cliente reserva desde web.
- Negocio ve reserva en dashboard.
- Sistema bloquea hueco ocupado.
- Cancelar libera hueco.

## Fase 5 - Comercio local completo

Objetivo: pasar de tienda basica a operacion real.

Tareas:

- [ ] Mejorar productos con categorias y variantes.
- [ ] Mejorar inventario.
- [ ] Mejorar pedidos.
- [ ] Recogida en tienda.
- [ ] Envio local.
- [ ] Promociones.
- [ ] Venta rapida tipo POS.
- [ ] Reporte de ventas.
- [ ] Cierre diario basico.

Criterios de aceptacion:

- Producto con variante funciona.
- Pedido descuenta stock.
- Negocio puede marcar pedido preparado.
- Se puede vender manualmente desde panel.

## Fase 6 - Presupuestos, facturas y pagos

Objetivo: cubrir negocios de servicios.

Tareas:

- [ ] Crear presupuesto.
- [ ] Crear PDF.
- [ ] Enviar por email.
- [ ] Convertir a factura.
- [ ] Crear enlace de pago Stripe.
- [ ] Estados.
- [ ] Exportacion CSV.

Criterios de aceptacion:

- Se puede crear presupuesto con lineas.
- Se genera PDF.
- Se registra pago.
- El cliente recibe enlace.

## Fase 7 - Marketing y reputacion

Objetivo: aumentar recurrencia y resenas.

Tareas:

- [ ] Crear campanas simples.
- [ ] Crear segmentos.
- [ ] Crear banners web.
- [ ] Crear solicitud de resena.
- [ ] Automatizacion post-compra.
- [ ] Automatizacion post-reserva.
- [ ] Reporte de resultados.

Criterios de aceptacion:

- Se puede lanzar promocion.
- Se puede pedir resena.
- El sistema muestra resultados basicos.

## Fase 8 - Reportes mensuales

Objetivo: justificar el mantenimiento mensual.

Tareas:

- [x] Registrar eventos de conversion.
- [x] Guardar eventos por negocio.
- [x] Desglosar conversiones por accion y fuente.
- [x] Dashboard de metricas.
- [x] API de reporte mensual operativo.
- [x] Generar reporte HTML imprimible.
- [x] Vista imprimible desde navegador.
- [ ] Exportacion PDF automatica.
- [x] Recomendaciones automaticas basicas.

Criterios de aceptacion:

- Reporte se genera en 1 click.
- Tiene datos utiles.
- Tiene recomendaciones accionables.
- Sirve para enviar al cliente.

## Fase 9 - IA avanzada

Objetivo: convertir LocalLift en asistente operativo.

Tareas:

- [ ] Base de conocimiento por negocio.
- [ ] Endpoint IA multi-negocio.
- [ ] Resumen de conversaciones.
- [ ] Sugerencias de respuesta.
- [ ] Generacion de textos web.
- [ ] Generacion de posts.
- [ ] Deteccion de leads calientes.
- [ ] Acciones seguras con confirmacion.

Criterios de aceptacion:

- La IA usa solo datos del negocio.
- No inventa disponibilidad ni precios cerrados.
- Pide confirmacion antes de acciones importantes.
- Reduce trabajo real del dueno.

## Fase 10 - Escalado comercial

Objetivo: vender y mantener muchos clientes con bajo coste.

Tareas:

- [ ] Planes comerciales claros.
- [ ] Panel interno de clientes.
- [ ] Facturacion recurrente.
- [ ] Alertas de salud por negocio.
- [ ] Backups automaticos.
- [ ] Plantillas por sector.
- [ ] Casos de exito.
- [ ] Proceso de soporte.

Criterios de aceptacion:

- Se pueden gestionar 20-50 negocios sin caos.
- Cada cliente tiene estado, plan y tareas.
- El equipo sabe que hacer cada semana.

## 10. Orden recomendado para empezar poco a poco

1. Crear backend multi-negocio JSON.
2. Crear base de datos ejemplo de negocios.
3. Conectar editor actual a cargar/guardar negocio por API.
4. Crear dashboard del negocio.
5. Crear modulo de leads.
6. Conectar formulario web y chatbot al backend.
7. Crear ficha de contacto.
8. Crear tareas y estados.
9. Crear reservas MVP.
10. Crear widget publico de reservas.
11. Mejorar tienda con categorias/variantes.
12. Crear reporte mensual basico.
13. Crear campanas/promociones.
14. Crear solicitudes de resena.
15. Crear presupuestos.
16. Crear facturas simples.
17. Crear roles y autenticacion.
18. Migrar a SQLite.
19. Crear integraciones Google reales.
20. Crear IA avanzada por negocio.

## 11. Plan comercial minimo

### Paquete 1: Presencia Local

Para negocios que necesitan una web profesional y captar contactos.

Incluye:

- Web premium.
- SEO local basico.
- Google checklist.
- WhatsApp/telefono/mapa.
- Chatbot local.
- Formulario de lead.
- Reporte simple.

Precio objetivo:

- Setup bajo.
- Mensualidad muy accesible.

### Paquete 2: Operacion Local

Para negocios que reciben reservas o leads.

Incluye:

- Todo Presencia Local.
- CRM.
- Reservas.
- Agenda.
- Reporte mensual.
- Solicitud de resenas.
- Cambios mensuales.

### Paquete 3: Comercio Local

Para tiendas, restaurantes y negocios con productos.

Incluye:

- Todo Presencia Local.
- Tienda.
- Pedidos.
- Pagos.
- Inventario.
- Cupones.
- Panel de pedidos.

### Paquete 4: Digitalizacion Total

Para negocios que quieren delegarlo casi todo.

Incluye:

- Web.
- CRM.
- Reservas.
- Tienda o presupuestos.
- Reportes.
- Marketing.
- Reputacion.
- IA.
- Soporte prioritario.

## 12. Metrica norte

La metrica principal no debe ser "numero de webs creadas".

La metrica principal debe ser:

> Conversiones utiles generadas para negocios activos por mes.

Conversiones utiles:

- llamadas
- WhatsApps
- reservas
- pedidos
- formularios
- pagos
- solicitudes de presupuesto

Metricas secundarias:

- tiempo medio de entrega de un negocio
- porcentaje de negocios con datos completos
- leads sin responder
- ingresos mensuales recurrentes
- churn
- coste operativo por cliente
- margen por cliente

## 13. Calidad minima por entrega

Cada negocio entregado debe pasar este checklist:

- [ ] Web revisada en movil.
- [ ] Web revisada en desktop.
- [ ] Imagenes no deformadas.
- [ ] CTA principal visible.
- [ ] Telefono correcto.
- [ ] WhatsApp correcto.
- [ ] Mapa correcto.
- [ ] Horario correcto.
- [ ] Servicios claros.
- [ ] FAQ minima.
- [ ] Resenas/testimonios.
- [ ] SEO title.
- [ ] SEO description.
- [ ] Schema LocalBusiness.
- [ ] Formulario probado.
- [ ] Chatbot probado.
- [ ] Tienda/reservas probadas si aplica.
- [ ] Export o publicacion validada.
- [ ] Reporte inicial generado.

## 14. Riesgos y como evitarlos

### Riesgo: construir demasiado

Solucion:

- Fases cortas.
- Cada fase debe venderse o mejorar retencion.
- No crear modulo sin caso de uso claro.

### Riesgo: parecer barato

Solucion:

- Diseno premium.
- Reportes profesionales.
- Lenguaje simple.
- Entrega guiada.
- Buen soporte.

### Riesgo: soporte manual infinito

Solucion:

- Onboarding guiado.
- Plantillas.
- Automatizaciones.
- Checklists.
- Base de conocimiento.
- Limites claros por plan.

### Riesgo: datos desordenados

Solucion:

- Modelo maestro.
- Validacion.
- Backups.
- Migracion a SQLite.
- Exportaciones.

### Riesgo: integraciones complejas

Solucion:

- Empezar con enlaces y webhooks simples.
- Integrar APIs solo cuando haya cliente que lo pague o uso repetido.
- Mantener proveedores intercambiables.

## 15. Fuentes y referencias de mercado

Referencias consultadas para orientar modulos y posicionamiento:

- Odoo pricing: https://www.odoo.com/pricing
- Odoo apps: https://apps.odoo.com/
- Square Appointments pricing: https://squareup.com/us/en/appointments/pricing
- Shopify POS features: https://www.shopify.com/pos/feature-sheet
- Zoho One apps overview: https://help.zoho.com/portal/en/kb/one/admin-guide/adding-apps/articles/zohoone-adding-apps-overview

No se debe copiar el modelo de estas plataformas tal cual. La oportunidad esta en simplificar, verticalizar y entregar el resultado completo a negocios que no tienen tiempo ni equipo tecnico.

## 16. Primera implementacion recomendada

La primera pieza que conviene construir ahora es:

> Backend multi-negocio + dashboard operativo basico + CRM de leads.

Motivo:

- Es la base para todo lo demas.
- Permite gestionar varios clientes.
- Conecta la web actual con valor operativo real.
- Hace que los leads no se pierdan.
- Da una razon clara para cobrar mantenimiento mensual.

Al terminar esa primera pieza, LocalLift dejara de ser solo un generador/exportador y empezara a comportarse como una plataforma de digitalizacion real.
