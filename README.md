# LocalLift Studio

Base web para digitalizar negocios locales: el cliente entrega datos, fotos y enlaces; la herramienta genera una web premium, dinamica y exportable como HTML completo.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/luicorcob/cascos)

## Como usarlo

1. Ejecuta `npm.cmd start` o abre `index.html` en el navegador.
2. Edita los datos del negocio desde el panel izquierdo.
3. Cambia fotos, servicios, testimonios, enlaces y estilo.
4. Prueba Desktop, Tablet y Movil desde la barra de vista previa.
5. Revisa el score de entrega del panel `Control de entrega`.
6. Pulsa `Exportar web` para descargar un HTML listo para subir a hosting.
7. Usa `Exportar datos` para guardar el negocio como JSON y reutilizarlo despues con `Importar datos`.
8. Con el servidor activo, abre `pages/business-dashboard.html` para revisar el primer portal operativo del negocio.

Para simular produccion o subir el backend, usa `npm run start:prod` con las variables de `.env.example`. Este comando valida `NODE_ENV=production`, `HOST=0.0.0.0`, token admin, CORS HTTPS y ruta de base persistente antes de arrancar.

Si el frontend esta en otro dominio, abre el Studio o el portal con `?apiBase=https://tu-api.com` o pega esa URL en el campo `URL API` del dashboard. LocalLift la guarda en el navegador y la usa para leads, reservas, eventos, dashboard y reportes.

## Formato de datos

- Servicios: una linea por servicio.
- Diferenciales: una linea por argumento de venta.
- Testimonios: `Nombre | Texto`.
- Preguntas frecuentes: `Pregunta | Respuesta`.
- Enlaces: `Nombre | URL`.
- Galeria: una URL de imagen por linea.
- Pruebas de confianza: una linea por argumento.
- Datos exportados: JSON con `version`, `exportedAt` y objeto `business`.

## Que incluye

- Editor de datos del negocio.
- Panel `Demo en vivo` para cambios delante del cliente: variantes, comando rapido, toggles de secciones y deshacer/rehacer.
- Vista previa dinamica en tiempo real.
- Ocho demos por sector: restaurante, clinica, belleza, gimnasio, bar, papeleria, kebab y bazar.
- Import/export de datos por cliente en JSON.
- Modulo de tienda online: catalogo, productos con imagen/precio, carrito, checkout Stripe y panel admin.
- Checklist de calidad con score de entrega.
- Cinco direcciones visuales: Aurora, Carbon, Editorial, Neon y Luxe.
- Personalizacion de CTA, titulares de seccion, tipografia, densidad, forma visual, color y animacion.
- Hero con imagen grande, malla luminica animada, scroll reveal, galeria en movimiento, parallax y tilt con raton.
- Secciones de servicios, prueba rapida, galeria, diferenciales, horario, confianza, testimonios, FAQ, mapa, captacion de leads y contacto.
- Dock flotante de conversion con reserva, llamada y mapa.
- Chatbot configurable por negocio con modo local y endpoint IA opcional.
- Portal operativo base con metricas, tabs, acciones rapidas, estados vacios y carga desde la API multi-negocio.
- Guardado local en navegador.
- Exportador de pagina standalone con CSS y JS integrados.
- Recursos locales en `assets/vendor/`: Lenis, Splitting.js, VanillaTilt y Open Props animations.

## Estructura del proyecto

```text
.
├── index.html              # Entrada principal del studio
├── src/                    # Frontend del editor y estilos principales
├── pages/                  # Vistas auxiliares: investor, onboarding, Google Ops y admin tienda
├── server/                 # Servidor local estatico
├── examples/               # Backends de ejemplo: chatbot, comercio y Google
├── assets/vendor/          # Dependencias frontend vendorizadas
├── data/                   # Base JSON local de tienda
└── docs/                   # Playbooks, checklists, ventas e inversores
```

## Recursos descargados

- `assets/vendor/lenis.min.js`: scroll suave cinematografico.
- `assets/vendor/splitting.min.js`: titulares animados por palabras y caracteres.
- `assets/vendor/vanilla-tilt.min.js`: tarjetas con tilt 3D y brillo.
- `assets/vendor/open-props-animations.min.css`: curvas y animaciones CSS reutilizables.

## Chatbot personalizado

La pestana `Chatbot` permite configurar:

- Nombre del asistente.
- Tono: directo, cercano o premium.
- Saludo inicial.
- Preguntas rapidas.
- Texto de traspaso a humano.
- Endpoint IA opcional.

Sin endpoint, el asistente responde localmente usando servicios, horarios, FAQ, telefono, email, ubicacion y enlaces del negocio. Esto funciona incluso en el HTML exportado.

Para IA real, levanta un backend y pega su URL en `Endpoint IA opcional`. Hay un ejemplo en `examples/chatbot-api.example.mjs`:

```powershell
$env:OPENAI_API_KEY="tu_api_key"
$env:OPENAI_MODEL="gpt-5-mini"
node examples/chatbot-api.example.mjs
```

Despues usa este endpoint en el editor:

```text
http://127.0.0.1:8787/api/chat
```

Nunca pongas una API key dentro de `index.html` ni en una web exportada.

## Captacion de leads

El bloque `Mostrar formulario de lead` crea un formulario en la web generada. El chatbot tambien puede capturar leads cuando el visitante escribe nombre + contacto + necesidad. Si el servidor local esta activo, ambos intentan guardar el lead en el CRM con `POST /api/public/{businessSlug}/leads`; si la web funciona standalone, todo se mantiene como respaldo en `window.localLiftLeads` y dispara eventos en `window.localLiftEvents`.

Eventos disponibles:

```text
booking_click
lead_form_submit
store_add_to_cart
store_checkout_start
chatbot_open
chatbot_prompt
chatbot_message
chatbot_lead_captured
public_booking_submit
dock_booking_click
dock_phone_click
dock_maps_click
```

## API multi-negocio

El servidor local incluye una primera API para gestionar negocios desde `data/business-db.json`.

```text
GET    http://127.0.0.1:5173/api/health
GET    http://127.0.0.1:5173/api/businesses
POST   http://127.0.0.1:5173/api/businesses
GET    http://127.0.0.1:5173/api/businesses/{id-o-slug}
PUT    http://127.0.0.1:5173/api/businesses/{id-o-slug}
DELETE http://127.0.0.1:5173/api/businesses/{id-o-slug}/archive
```

Filtros de listado:

```text
?q=brasa&status=published&category=restaurante&plan=operacion-local&includeArchived=true
```

Base inicial:

```powershell
npm.cmd run seed:businesses
```

`/api/health` sirve para despliegue y monitorizacion: devuelve estado del servicio, entorno, latencia, uptime, lectura/escritura de base local y conteos principales.

Para produccion, define `LOCALLIFT_ADMIN_TOKEN` o `ADMIN_API_TOKEN` en el backend. Si existe, todas las rutas administrativas `/api/businesses/*` exigen `Authorization: Bearer ...` o `X-LocalLift-Admin-Token`; el portal del negocio permite guardar ese token desde la barra lateral. Sin token configurado, el servidor mantiene el modo local abierto para desarrollo.

`CORS_ORIGIN` permite limitar que dominios frontend pueden llamar a la API desde navegador. Si no se define, el servidor usa `*` para desarrollo local. Hay una plantilla completa en `.env.example`.

El guardado es atomico y crea copias en `data/backups/` antes de cambios importantes. Para pruebas automatizadas se puede usar `BUSINESS_DB_FILE` y `BUSINESS_DB_BACKUPS=false`.

Desde el Studio principal, `Guardar` mantiene una copia en el navegador y tambien intenta sincronizar con esta API. `Cargar` recupera el ultimo negocio sincronizado si el servidor esta activo y usa localStorage como respaldo.

## API CRM y leads

La base `data/business-db.json` tambien puede guardar `contacts` y `activities`, separados por `businessId`.

```text
POST  http://127.0.0.1:5173/api/public/{businessSlug}/leads
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts?includeActivities=true
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts
PATCH http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts/{contactId}
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts/{contactId}/activities
```

El portal `pages/business-dashboard.html` usa estos endpoints para mostrar pipeline de leads, cambiar estado y guardar notas/tareas en el historial.

## API y widget de reservas

La agenda MVP guarda `services`, `bookings`, `availability`, `bookingBlocks` y `bookingReminders` en `data/business-db.json`. Si un negocio todavia no tiene servicios reservables, la API puede generar servicios iniciales desde los servicios de la web.

Cuando `Mostrar reserva` esta activo, la web publica generada incluye un bloque visible `#reservas` con servicio, fecha/hora, nombre, contacto y nota. Si la API esta activa, envia la reserva a `POST /api/public/{businessSlug}/bookings`; si no, conserva el intento en `window.localLiftBookings`.

```text
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/services
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/services
PATCH http://127.0.0.1:5173/api/businesses/{id-o-slug}/services/{serviceId}
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/bookings
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/bookings
PATCH http://127.0.0.1:5173/api/businesses/{id-o-slug}/bookings/{bookingId}
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/bookings/{bookingId}/reminders
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/reminders?hours=48
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/reminders
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/availability
PUT   http://127.0.0.1:5173/api/businesses/{id-o-slug}/availability
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/blocks
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/blocks
PATCH http://127.0.0.1:5173/api/businesses/{id-o-slug}/blocks/{blockId}
POST  http://127.0.0.1:5173/api/public/{businessSlug}/bookings
POST  http://127.0.0.1:5173/api/public/{businessSlug}/events
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/events
```

Las reservas publicas crean o actualizan un contacto CRM, guardan actividad y bloquean solapes, huecos fuera de disponibilidad semanal y cierres manuales con respuesta `409`. El portal incluye calendario semanal, recordatorios manuales y cola de recordatorios proximos en modo dry-run: la API registra la accion en CRM y devuelve enlaces listos para WhatsApp o email sin enviar automaticamente.

Los eventos de conversion de la web generada se guardan localmente en `window.localLiftEvents` y, si la API esta activa, tambien se sincronizan contra `POST /api/public/{businessSlug}/events` para alimentar el reporte mensual. El dashboard y el reporte imprimible muestran conversiones por accion (`phone_click`, `booking_click`, leads, chatbot, mapa...) y fuentes de evento.

## Reporte mensual operativo

El portal usa `GET /api/businesses/{id-o-slug}/reports/monthly?month=YYYY-MM` para generar un resumen mensual con contactos, reservas, recordatorios, pedidos, ingresos, embudo, fuentes y recomendaciones accionables. Si no se pasa `month`, usa el mes actual.

La version imprimible esta en `pages/monthly-report.html?business={id-o-slug}&month=YYYY-MM` e incluye boton de impresion para enviar el informe al cliente en PDF desde el navegador.

## Tienda online y pagos

La pestana `Tienda` permite activar compras online en la web generada:

- Productos: `Nombre | Precio | Imagen URL | Descripcion | SKU | Stock`.
- Catalogo visible en la web con carrito y formulario de comprador.
- Experiencia movil prioritaria: vista previa movil por defecto, botones tactiles, CTA inferior `Comprar` y barra de carrito con total para volver al pago en un toque.
- Endpoint de productos para leer una base de datos real.
- Endpoint de configuracion para metodos de envio, IVA, moneda, terminos y privacidad.
- Validacion de carrito antes de pagar: stock, envio, cupones, impuestos y total final.
- Endpoint de checkout para redirigir a Stripe Checkout.
- Pedidos con estados: `pending`, `paid`, `preparing`, `ready`, `fulfilled`, `canceled`, `expired`, `failed`, `refunded`.
- Emails de pedido para el negocio y confirmacion para el comprador cuando Stripe confirme el pago.

Panel del dueno de tienda:

```text
pages/store-admin.html
```

Incluye resumen, productos, pedidos, cambios de estado, cupones, metodos de envio, IVA, URLs de exito/cancelacion, terminos y paises permitidos.

## Portal del negocio

El primer panel operativo vive en:

```text
pages/business-dashboard.html
```

Carga negocios desde la API local, permite cambiar de negocio y muestra Inicio, Leads, Clientes, Reservas, Pedidos, Productos, Reportes y Ajustes. En Reservas ya se pueden crear citas manuales, confirmar, completar o cancelar reservas. En Reportes hay acceso directo al informe mensual imprimible.

Backend de ejemplo con la libreria oficial de Stripe:

```powershell
npm install
$env:STORE_ADMIN_TOKEN="usa-un-token-largo-aleatorio-de-32-caracteres-minimo"
$env:CORS_ORIGIN="https://tutienda.com,https://www.tutienda.com"
$env:CHECKOUT_ALLOWED_ORIGINS="https://tutienda.com,https://www.tutienda.com"
$env:STRIPE_SECRET_KEY="sk_test_..."
$env:STRIPE_WEBHOOK_SECRET="whsec_..."
$env:ORDER_EMAIL_TO="pedidos@tunegocio.com"
$env:RESEND_API_KEY="re_..." # opcional para email propio de pedido
node examples/commerce-api.example.mjs
```

Endpoints:

```text
GET    http://127.0.0.1:8795/api/store/config
GET    http://127.0.0.1:8795/api/store/products
POST   http://127.0.0.1:8795/api/store/cart/validate
POST   http://127.0.0.1:8795/api/store/products
PUT    http://127.0.0.1:8795/api/store/products/{id}
DELETE http://127.0.0.1:8795/api/store/products/{id}
POST   http://127.0.0.1:8795/api/store/checkout
POST   http://127.0.0.1:8795/api/store/webhook
GET    http://127.0.0.1:8795/api/store/orders
GET    http://127.0.0.1:8795/api/store/admin/summary
GET    http://127.0.0.1:8795/api/store/admin/products
GET    http://127.0.0.1:8795/api/store/admin/orders
PATCH  http://127.0.0.1:8795/api/store/admin/orders/{id}
GET    http://127.0.0.1:8795/api/store/admin/coupons
POST   http://127.0.0.1:8795/api/store/admin/coupons
PUT    http://127.0.0.1:8795/api/store/admin/settings
```

Flujo de produccion:

1. Crear cuenta en Stripe y copiar `STRIPE_SECRET_KEY`.
2. En Stripe, crear un webhook hacia `https://tu-api.com/api/store/webhook` y copiar `STRIPE_WEBHOOK_SECRET`.
3. Publicar `examples/commerce-api.example.mjs` en un servidor Node con HTTPS.
4. Abrir `pages/store-admin.html`, poner URL de API y token admin, y cargar productos.
5. En la pestana `Tienda`, poner los endpoints publicos de productos y checkout.
6. Exportar la web y subirla al hosting.

Stripe envia recibos al comprador si lo tienes activo en el dashboard. El backend marca pedidos como pagados, descuenta stock y puede enviar el email interno del pedido con Resend; si no configuras Resend, el pedido queda guardado en `data/store-db.json` y aparece por API en `/api/store/orders`.

La API reserva stock mientras el checkout esta pendiente y libera esa reserva si Stripe marca la sesion como expirada o fallida. Los cupones se aplican en servidor, se limitan por uso/minimo/caducidad, y solo incrementan uso cuando el pago queda confirmado.

Blindaje incluido:

- Libreria oficial `stripe` para crear Checkout Sessions y verificar webhooks con `Stripe-Signature`.
- `STORE_ADMIN_TOKEN` obligatorio, de 32+ caracteres, comparado en tiempo constante.
- CORS cerrado por defecto a `http://127.0.0.1:5173` y `http://localhost:5173`; en produccion hay que poner los dominios reales en `CORS_ORIGIN`.
- Redirecciones de checkout limitadas a `CHECKOUT_ALLOWED_ORIGINS` para evitar redirecciones manipuladas.
- Rate limit separado para carrito, checkout y panel admin.
- Cabeceras de seguridad para API: `Content-Security-Policy`, `X-Frame-Options`, `nosniff`, `Permissions-Policy`, HSTS y `Cache-Control: no-store`.
- JSON estricto, tamano maximo de body por `MAX_BODY_BYTES` y escritura atomica de `data/store-db.json`.

## Mapa y Google

La pestana `Google` permite configurar Google Maps URL, URL embed de mapa, nota de llegada/parking, enlace de resenas y URL de reserva. Si no hay URL embed, LocalLift genera un iframe de mapa con direccion, ciudad y nombre del negocio.

## Demo en vivo

El panel `Demo en vivo` permite aplicar cambios sin navegar por todas las pestanas:

- Variantes: mas premium, mas limpio, mas urgencia, mas confianza, vender reservas, pedidos rapidos, mas local y modo movil.
- Comandos: escribe frases como `mas premium`, `vender reservas`, `sin mapa`, `sin bot`, `mostrar todo`.
- Toggles de seccion: anuncio, beneficios, confianza, galeria, resenas, FAQ, mapa, lead, bot, tienda y dock.
- Deshacer/Rehacer para probar cambios delante del cliente sin perder la version anterior.

## Siguiente nivel recomendado

- Convertir el JSON por cliente en un CRM multi-cliente con historial y estados.
- Anadir subida directa de imagenes a Cloudinary, Supabase Storage o S3.
- Crear mas plantillas por sector: academia, taller, tienda especializada, inmobiliaria y servicios profesionales.
- Generar textos con IA a partir de un cuestionario corto.
- Publicar automaticamente en Netlify, Vercel o un servidor propio.

## Material comercial

- `docs/PLAN_MAESTRO_DIGITALIZACION_TOTAL.md`: plan maestro para convertir LocalLift en plataforma completa de digitalizacion de negocios locales.
- `docs/PRODUCT_ACTION_PLAN.md`: investigacion, posicionamiento, paquetes, roadmap y guion de venta.
- `docs/SALES_ONE_PAGER.md`: propuesta corta para enviar a negocios por WhatsApp/email.
- `docs/INVESTOR_MEMO.md`: memo ejecutivo para inversores.
- `docs/INVESTOR_DEMO_SCRIPT.md`: guion para presentar la demo.
- `docs/DEPLOYMENT.md`: guia inicial para publicar frontend, backend y healthcheck.
- `docs/PILOT_LAUNCH.md`: runbook para publicar y validar el primer piloto online.
- `docs/DELIVERY_CHECKLIST.md`: estado de entrega y siguientes hitos.
- `docs/GOOGLE_INTEGRATION_PLAN.md`: arquitectura para Google Maps, Business Profile, Calendar, reseñas y reservas.
- `docs/GOOGLE_CLIENT_SERVICE_PLAYBOOK.md`: playbook para vender y operar correo profesional, GBP, reseñas y reservas.
- `docs/PROJECT_STRUCTURE.md`: mapa de carpetas y convenciones del proyecto.
- `pages/google-ops.html`: vista comercial/operativa del servicio Google gestionado.
- `docs/COMPATIBILITY_CHECKLIST.md`: checklist para moviles, navegadores y testing manual.
- `pages/investor.html`: pitch navegable con demo de producto.
- `pages/onboarding.html`: brief para recopilar datos del cliente.

## Backend Google opcional

`examples/google-integration.example.mjs` es una base para conectar:

- Places API: enriquecer negocio por Place ID.
- Calendar FreeBusy: comprobar disponibilidad.
- Calendar Events: crear reservas/citas.
- Business Profile: cuentas, ubicaciones, reseñas y respuestas.
- Workspace Admin SDK: crear usuarios de correo profesional bajo dominio del cliente.
- Review request: generar mensajes para pedir reseñas.

Ejemplo:

```powershell
$env:GOOGLE_MAPS_API_KEY="tu_maps_api_key"
$env:GOOGLE_CALENDAR_ACCESS_TOKEN="oauth_access_token_del_negocio"
$env:GOOGLE_CALENDAR_ID="primary"
$env:GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN="oauth_business_profile_del_negocio"
$env:GOOGLE_WORKSPACE_ADMIN_ACCESS_TOKEN="oauth_admin_workspace_del_cliente"
node examples/google-integration.example.mjs
```

Endpoints:

```text
GET  http://127.0.0.1:8790/api/google/place?placeId=ChIJ...
POST http://127.0.0.1:8790/api/google/availability
POST http://127.0.0.1:8790/api/google/book
GET  http://127.0.0.1:8790/api/google/business/accounts
GET  http://127.0.0.1:8790/api/google/business/locations?accountId=...
GET  http://127.0.0.1:8790/api/google/reviews?accountId=...&locationId=...
POST http://127.0.0.1:8790/api/google/reviews/reply
POST http://127.0.0.1:8790/api/google/workspace/user
POST http://127.0.0.1:8790/api/google/review-request
```

En produccion hay que implementar OAuth persistente y guardar tokens cifrados por negocio.

Nota: la creacion de correo profesional debe hacerse con Google Workspace del dominio del cliente y permisos de administrador. No se crean cuentas Gmail personales para clientes.
