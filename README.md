# DLS Studio · Digital Local Sites

DLS es la plataforma para crear y operar sitios digitales de negocios locales. El rebranding conserva temporalmente identificadores tecnicos `LocalLift*`, claves `locallift_*`, cabeceras y variables de entorno antiguas para mantener compatibilidad con despliegues y datos ya guardados.

Base web para digitalizar negocios locales: el cliente entrega datos, fotos y enlaces; la herramienta genera una web premium, dinamica y exportable como HTML completo.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/luicorcob/cascos)

Para que el Radar funcione sin arrancarlo desde tu portátil, despliega este repositorio en Render como **Web Service Node** usando el botón anterior o el Blueprint `render.yaml`. No lo despliegues como Static Site: el radar necesita que Render ejecute `npm run start:prod` y sirva `/api/discovery/config`.

## Como usarlo

1. Ejecuta `npm.cmd start` y abre `http://127.0.0.1:5173/` para ver la landing pública.
2. Entra como desarrollador desde la landing o abre `workspace.html?hub=1&mode=developer` para ir directamente al workspace.
3. Edita los datos del negocio desde el panel izquierdo.
4. Cambia fotos, servicios, testimonios, enlaces y estilo.
5. Activa `Editar preview` y cambia textos, imagenes, encuadres, botones y enlaces directamente sobre la web.
6. Mueve u oculta secciones desde sus controles sobre la preview.
7. Anade, duplica, reordena o borra servicios, diferenciales, resenas, FAQ y fotos desde el lienzo.
8. Elige bloques o aplica y guarda composiciones reutilizables sin perder contenidos.
9. Reutiliza imagenes subidas o URLs desde `Fotos > Biblioteca de medios`.
10. Genera un set de imagenes por negocio desde `POST /api/site-images` si tienes claves de Unsplash, Pexels o Pixabay.
11. Prueba Desktop, Tablet y Movil desde la barra de vista previa.
12. Pulsa `Entrega Pro` para generar un preflight con bloqueos, avisos y siguientes pasos.
13. Revisa el score de entrega; los errores criticos bloquean la exportacion.
14. Con el servidor publicado en un dominio publico, pulsa `Publicar demo` para obtener una URL temporal lista para enviar al cliente. Si estas en local, puedes configurar el publicador gratis de Cloudflare Workers + KV para que el enlace sea publico y caduque solo.
15. Pulsa `Exportar web` para descargar un HTML listo para subir a hosting.
16. Usa `Exportar paquete` para descargar un ZIP con HTML, `business.json`, ficha de entrega y cambios.
17. Usa `Exportar datos` para guardar el negocio como JSON y reutilizarlo despues con `Importar datos`.
18. Con el servidor activo, abre `pages/admin-dashboard.html` para el CRM interno de DLS o `pages/client-dashboard.html` para el portal privado de un negocio.

Para enseñar directamente la demo Luma Studio sin mostrar el editor, abre
`workspace.html?presentation=true&view=mobile`. Tambien admite `view=tablet` y
`view=desktop`.

Para simular produccion o subir el backend, usa `npm run start:prod` con las variables de `.env.example`. En Render ese comando queda configurado como Start Command del Web Service. Este comando valida `NODE_ENV=production`, `HOST=0.0.0.0`, token admin, CORS HTTPS y ruta de base persistente antes de arrancar.

Para dejar las demos online temporales casi automaticas, autentica Cloudflare una vez con `npx wrangler login` y despues ejecuta:

```powershell
npm.cmd run setup:demo-online
```

El script crea el KV, guarda el secret, despliega el Worker y actualiza `.env` con `DEMO_REMOTE_PUBLISH_URL` y `DEMO_REMOTE_PUBLISH_TOKEN` sin imprimir el token completo.
Despues basta con `npm.cmd start` y el boton `Publicar demo online`.

Si el frontend esta en otro dominio, abre el Studio o el portal con `?apiBase=https://tu-api.com` o pega esa URL en el campo `URL API` del dashboard. DLS la guarda en el navegador y la usa para leads, reservas, eventos, dashboard y reportes.

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
- Panel `Demo en vivo` para cambios delante del cliente: variantes, comando rapido, orden de secciones y deshacer/rehacer.
- Edicion directa de textos, imagenes, encuadres, botones y enlaces desde la preview.
- Estilo de botones principales desde la preview: color de fondo, color de texto y neon activable con intensidad regulable.
- Estilos por texto desde la preview: color, opacidad, tamano, peso, cursiva y espaciado.
- Controles contextuales para mover u ocultar secciones sobre el lienzo.
- Duplicado y eliminacion de copias de secciones completas desde la preview.
- Controles por elemento para anadir, duplicar, subir, bajar y borrar contenido repetido desde la preview.
- Accion rapida `Escaparate visual` para reducir letras, priorizar imagenes y dejar CTA/prueba social al frente.
- Biblioteca de variantes para portada, servicios, galeria, resenas y contacto.
- Composiciones reutilizables que conservan el contenido del negocio.
- Gestor local de medios con compresion, dimensiones, texto alternativo y reutilizacion.
- Modulo de imagenes por negocio con Unsplash, Pexels y Pixabay, creditos, alt text y foco CSS.
- Autoguardado de borrador con recuperacion al volver a abrir el Studio.
- Vista previa dinamica en tiempo real.
- Ocho demos por sector: restaurante, clinica, belleza, gimnasio, bar, papeleria, kebab y bazar.
- Import/export de datos por cliente en JSON.
- Modulo de tienda online: catalogo, productos con imagen/precio, carrito, checkout Stripe y panel admin.
- Checklist de calidad con score de entrega.
- QA visual y accesibilidad profunda con capturas desktop/tablet y movil a 390/320 px, barrido de toda la pagina, contraste WCAG y contraste sobre los pixeles renderizados, tamano y recorte de imagenes, tipografia, teclado, foco, formularios y solapes.
- Modo `Entrega Pro` con preflight operativo, bloqueos, avisos, checklist y siguiente paso recomendado.
- Paquete de entrega en ZIP con web standalone, datos del negocio, ficha operativa y registro de cambios.
- Validacion de entrega que marca campos y bloquea exportaciones invalidas.
- Cinco direcciones visuales: Aurora, Carbon, Editorial, Neon y Luxe.
- Seis direcciones artisticas estructurales: Cine, Revista, Cartel, Mosaico, Atelier y Kinetica.
- Modo `Auto unica` con huella visual estable por negocio para evitar webs repetidas.
- Modos de contenido Muy visual, Equilibrado y Completo para controlar la carga de texto; `Muy visual` limita piezas visibles y comprime copys largos.
- Personalizacion de CTA, titulares de seccion, tipografia, densidad, forma visual, color y animacion.
- Hero con imagen grande, malla luminica animada, scroll reveal, galeria en movimiento, parallax y tilt con raton.
- Collages con profundidad y parallax tactil mediante Atropos.
- Secciones de servicios, prueba rapida, galeria, diferenciales, horario, confianza, testimonios, FAQ, mapa, captacion de leads y contacto.
- Dock flotante de conversion con reserva, llamada y mapa.
- Chatbot configurable por negocio con modo local y endpoint IA opcional.
- Portal operativo base con metricas, tabs, acciones rapidas, estados vacios y carga desde la API multi-negocio.
- Guardado local en navegador.
- Publicacion temporal de demos desde el Studio con popup de enlace, URL `/demos/...`, copia al portapapeles, guardado de `publishedUrl` y estado `Demo activa` en Proyectos solo cuando la URL es publica. Puede usar el disco del backend o un publicador remoto gratis con Cloudflare Workers + KV y TTL automatico. Los enlaces `localhost`/`127.0.0.1` se marcan como diagnostico local para no enviarlos al cliente por error.
- Exportador de pagina standalone con CSS y JS integrados.
- Recursos locales en `assets/vendor/`: Lenis, Splitting.js, VanillaTilt y Open Props animations.

## Estructura del proyecto

```text
.
├── index.html              # Landing pública corporativa
├── workspace.html          # Entrada del Studio y selector developer/cliente
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
- `assets/vendor/gsap.min.js`, `ScrollTrigger.min.js` y `SplitText.min.js`: animación y narrativa de la landing.
- `assets/vendor/three.module.min.js`: shader WebGL del hero con fallback automático.
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

El servidor incluye una API para gestionar negocios, CRM, reservas, eventos y reportes. Por defecto usa `data/business-db.json` para desarrollo local; en produccion puede usar PostgreSQL activando `BUSINESS_STORE=postgres` y `DATABASE_URL`.

```text
GET    http://127.0.0.1:5173/api/health
GET    http://127.0.0.1:5173/api/businesses
POST   http://127.0.0.1:5173/api/businesses
GET    http://127.0.0.1:5173/api/businesses/{id-o-slug}
PUT    http://127.0.0.1:5173/api/businesses/{id-o-slug}
DELETE http://127.0.0.1:5173/api/businesses/{id-o-slug}
DELETE http://127.0.0.1:5173/api/businesses/{id-o-slug}/archive
```

## API de imagenes por negocio

`POST /api/site-images` recibe `negocio`, `business` o un objeto plano con nombre, tipo, ubicacion, estilo, secciones y servicios. Devuelve un JSON con imagenes para `hero`, `servicios`, `galeria`, `contacto` y otras secciones compatibles, incluyendo creditos, alt text, foco CSS y query usada.

El endpoint usa `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY` y `PIXABAY_API_KEY` por ese orden. Con Unsplash activo, cada negocio calcula una pagina de resultados estable a partir de su nombre, categoria, ubicacion y estilo, para que negocios parecidos no reciban siempre la misma primera tanda de fotos. Si no hay claves o no hay resultados validos, devuelve `null` y avisos en `meta.advertencias` sin inventar URLs.

El buscador manual del inspector usa `GET /api/stock-images`. Si `UNSPLASH_ACCESS_KEY` esta configurada, busca primero en Unsplash; si no, o si Unsplash no devuelve resultados validos, mantiene Wikimedia Commons como fallback sin clave. Guarda solo la Access Key en `.env`; la Secret Key no debe ir en frontend, HTML exportado ni ejemplos.

```powershell
$body = @{
  negocio = @{
    nombre = "Peluqueria Lucia"
    tipo = "peluqueria"
    descripcion = "Salon de belleza para mujer en Sevilla"
    ubicacion = "Sevilla, Espana"
    estilo_web = "elegante y femenino"
    secciones = @("hero", "servicios", "galeria", "contacto")
    servicios = @("Corte de pelo", "Coloracion profesional", "Tratamientos capilares")
  }
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5173/api/site-images" -Body $body -ContentType "application/json"
```

Filtros de listado:

```text
?q=brasa&status=published&category=restaurante&plan=operacion-local&includeArchived=true
```

Base inicial:

```powershell
npm.cmd run seed:businesses
```

Migrar el JSON actual a PostgreSQL:

```powershell
$env:BUSINESS_STORE="postgres"
$env:DATABASE_URL="postgres://usuario:password@host:5432/db"
npm.cmd run migrate:businesses:postgres
```

`/api/health` sirve para despliegue y monitorizacion: devuelve estado del servicio, entorno, latencia, uptime, modo de persistencia (`json` o `postgres`), lectura/escritura y conteos principales.

Para produccion, define `LOCALLIFT_ADMIN_TOKEN` o `ADMIN_API_TOKEN` en el backend. Si existe, todas las rutas administrativas `/api/businesses/*` exigen `Authorization: Bearer ...` o `X-LocalLift-Admin-Token`; el portal del negocio permite guardar ese token desde la barra lateral. Sin token configurado, el servidor mantiene el modo local abierto para desarrollo.

`CORS_ORIGIN` permite limitar que dominios frontend pueden llamar a la API desde navegador. Si no se define, el servidor usa `*` para desarrollo local. Hay una plantilla completa en `.env.example`.

Con JSON, el guardado es atomico y crea copias en `data/backups/` antes de cambios importantes. Con PostgreSQL, el store crea tablas e indices automaticamente y guarda cada coleccion en `jsonb`. Para pruebas automatizadas se puede usar `BUSINESS_DB_FILE` y `BUSINESS_DB_BACKUPS=false`.

Para recuperar una copia con el backend detenido, usa `npm.cmd run restore:businesses -- "ruta-a-la-copia.json" --confirm`. Si `DATABASE_URL` esta activo y no pasas un target de archivo, restaura PostgreSQL y antes guarda una copia JSON del estado actual. El procedimiento completo de salud diaria y restauracion esta en `docs/operaciones/OPERATIONS_RUNBOOK.md`.

Antes de desplegar, `npm.cmd run smoke:pilot` levanta un backend temporal y verifica salud, autenticacion admin, lead, reserva, consentimiento, cambios de estado, eventos y reporte sin tocar la base real.

## Modos de acceso

La entrada principal separa dos superficies:

- **Developer**: Studio, Radar, brief, tienda, Google Ops y herramientas internas.
- **Cliente**: login con nombre de negocio y contrasena para abrir solo su portal operativo.

Para crear o cambiar la contrasena de un cliente:

```powershell
npm.cmd run client:password -- "brasa-norte" "Portal2026!"
```

El password se guarda como hash `scrypt` dentro del negocio, en `settings.portal.passwordHash`. Las sesiones cliente usan `CLIENT_SESSION_SECRET`; en produccion define tambien `LOCALLIFT_ADMIN_TOKEN` para que las rutas internas no queden abiertas sin token developer.

Para verificar la arquitectura y comportamiento modular del Studio:

```powershell
npm.cmd run check
npm.cmd run test:studio
```

La suite cubre utilidades, historial, autoguardado, cliente de datos,
validacion, renderizado, exportacion y el limite de tamano de `src/app.js`.

Desde el Studio principal, `Guardar` mantiene una copia en el navegador y tambien intenta sincronizar con esta API. `Cargar` recupera el ultimo negocio sincronizado si el servidor esta activo y usa localStorage como respaldo.

## API CRM y leads

El store del dashboard guarda `contacts` y `activities`, separados por `businessId`, en JSON local o PostgreSQL segun la configuracion.

```text
POST  http://127.0.0.1:5173/api/public/{businessSlug}/leads
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts?includeActivities=true
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts/pipeline
GET   http://127.0.0.1:5173/api/businesses/{id-o-slug}/next-actions?filter=hoy|vencidas|sin-accion
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts
PATCH http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts/{contactId}
PATCH http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts/{contactId}/pipeline
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts/{contactId}/next-action
PATCH http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts/{contactId}/next-action
POST  http://127.0.0.1:5173/api/businesses/{id-o-slug}/contacts/{contactId}/activities
```

El portal `pages/client-dashboard.html` usa estos endpoints para mostrar el pipeline Kanban del propio local, cambiar estado, persistir el orden manual por columna, gestionar la proxima actividad y guardar notas/tareas en el historial.

## API y widget de reservas

La agenda MVP guarda `services`, `bookings`, `availability`, `bookingBlocks` y `bookingReminders` en el mismo store del dashboard. Si un negocio todavia no tiene servicios reservables, la API puede generar servicios iniciales desde los servicios de la web.

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
- Stripe puede enviar el recibo al comprador y el negocio consulta el pedido confirmado desde su portal.

Panel del dueño de la tienda:

```text
pages/client-dashboard.html?tab=commerce
```

El módulo `Tienda online` vive dentro del portal autenticado del negocio. Incluye resumen, productos, pedidos, cambios de estado, cupones, métodos de envío, IVA, URLs de éxito/cancelación, términos y países permitidos. `pages/store-admin.html` se conserva únicamente como redirección heredada.

Studio mantiene la responsabilidad de diseño: activar la sección, ordenar su contenido y previsualizarla. La operación diaria pertenece al portal del negocio.

## Dashboards separados por responsabilidad

La aplicación tiene dos espacios deliberadamente independientes:

- `pages/admin-dashboard.html`: **Control DLS**, exclusivo para el desarrollador/vendedor. Reúne negocios clientes, estado de desarrollo y publicación, ofertas, proyectos, suscripciones, facturación, cobros, documentos, accesos y soporte.
- `pages/client-dashboard.html`: **Portal del cliente**, limitado a un negocio autenticado. Reúne clientes del local, reservas, empleados, turnos, inventario, tienda online, cuentas, informes y el proyecto contratado a DLS.

`pages/projects.html` y `pages/business-dashboard.html` se mantienen como rutas heredadas y redirigen a los espacios anteriores. Una entrada directa al portal del cliente sin sesión muestra el bloqueo de acceso; la vista desde Control DLS se abre explícitamente con `preview=developer`.

### Portal del negocio

El primer panel operativo vive en:

```text
pages/client-dashboard.html
```

Carga negocios desde la API local, permite cambiar de negocio y muestra Inicio, Leads, Clientes, Reservas, Tienda online, Reportes y Ajustes. En Reservas ya se pueden crear citas manuales, confirmar, completar o cancelar reservas. En Tienda online se gestiona el catálogo y el ciclo operativo de los pedidos. En Reportes hay acceso directo al informe mensual imprimible.

Las tabs de Leads, Clientes y Reservas incluyen exportacion CSV para entregar datos al cliente o usarlos en hojas de calculo.

El comercio multi-negocio forma parte del backend principal. Cada catálogo, pedido, cupón y configuración se guarda dentro de la ficha del negocio y queda protegido por la sesión del portal, los roles del equipo o el token administrador de DLS.

Configuración de Stripe:

```powershell
npm install
$env:CORS_ORIGIN="https://tutienda.com,https://www.tutienda.com"
$env:STRIPE_SECRET_KEY="sk_test_..."
$env:STRIPE_COMMERCE_WEBHOOK_SECRET="whsec_..."
npm start
```

Endpoints privados por negocio:

```text
GET    /api/businesses/{id-o-slug}/commerce/summary
GET    /api/businesses/{id-o-slug}/commerce/products
POST   /api/businesses/{id-o-slug}/commerce/products
PATCH  /api/businesses/{id-o-slug}/commerce/products/{id}
DELETE /api/businesses/{id-o-slug}/commerce/products/{id}
GET    /api/businesses/{id-o-slug}/commerce/orders
PATCH  /api/businesses/{id-o-slug}/commerce/orders/{id}
GET    /api/businesses/{id-o-slug}/commerce/coupons
POST   /api/businesses/{id-o-slug}/commerce/coupons
PATCH  /api/businesses/{id-o-slug}/commerce/coupons/{id}
DELETE /api/businesses/{id-o-slug}/commerce/coupons/{id}
GET    /api/businesses/{id-o-slug}/commerce/settings
PUT    /api/businesses/{id-o-slug}/commerce/settings
```

Endpoints públicos de la web:

```text
GET  /api/public/{slug}/store/config
GET  /api/public/{slug}/store/products
POST /api/public/{slug}/store/cart/validate
POST /api/public/{slug}/store/checkout
GET  /api/public/{slug}/store/orders/{id}?token={token}
POST /api/webhooks/stripe/commerce
```

Flujo de producción:

1. Crear cuenta en Stripe y copiar `STRIPE_SECRET_KEY`.
2. En Stripe, crear un webhook hacia `https://tu-api.com/api/webhooks/stripe/commerce` y copiar el secreto en `STRIPE_COMMERCE_WEBHOOK_SECRET`.
3. Entrar en `Portal del cliente > Tienda online`, completar la configuración y guardar. El portal conecta automáticamente los endpoints públicos del negocio.
4. Añadir productos y activar la tienda.
5. En Studio, revisar el diseño de la sección y publicar la web.

La API reserva stock al crear el checkout, aplica cupones e impuestos en servidor y asocia el pedido al `businessId` autenticado. Stripe confirma el pago mediante firma `Stripe-Signature`; en desarrollo sin claves se utiliza un checkout local simulado.

`examples/commerce-api.example.mjs` y `data/store-db.json` permanecen como ejemplo autónomo heredado, pero ya no son el origen de datos del portal multi-negocio.

## Mapa y Google

La pestana `Google` permite configurar Google Maps URL, URL embed de mapa, nota de llegada/parking, enlace de resenas y URL de reserva. Si no hay URL embed, DLS genera un iframe de mapa con direccion, ciudad y nombre del negocio.

## Demo en vivo

El panel `Demo en vivo` permite aplicar cambios sin navegar por todas las pestanas:

- Direcciones: refinar marca, simplificar, acelerar decision, reforzar confianza, priorizar reservas, facilitar pedidos, enfatizar cercania y optimizar movil.
- Comandos: escribe frases como `refina la marca`, `prioriza reservas`, `sin mapa`, `sin bot`, `mostrar todo` (los comandos anteriores siguen siendo compatibles).
- Toggles de seccion: anuncio, beneficios, confianza, galeria, resenas, FAQ, mapa, lead, bot, tienda y dock.
- Deshacer/Rehacer para probar cambios delante del cliente sin perder la version anterior.

## Siguiente nivel recomendado

- Convertir el JSON por cliente en un CRM multi-cliente con historial y estados.
- Anadir subida directa de imagenes a Cloudinary, Supabase Storage o S3.
- Crear mas plantillas por sector: academia, taller, tienda especializada, inmobiliaria y servicios profesionales.
- Generar textos con IA a partir de un cuestionario corto.
- Convertir la publicacion temporal en deploy permanente a Netlify, Vercel o dominio propio.

## Documentacion

- [Objetivo y siguientes acciones](docs/AHORA.md)
- [Mapa y reglas de la documentacion](docs/README.md)
- [Publicar demos gratis con Cloudflare Workers](docs/operaciones/DEMO_PUBLISH_CLOUDFLARE.md)
- [Vista del servicio Google gestionado](pages/google-ops.html)
- [Pitch navegable para inversores](pages/investor.html)
- [Brief de onboarding](pages/onboarding.html)

## Integracion Google productiva

El servidor principal incluye OAuth persistente por negocio, refresh automatico
y tokens cifrados fuera de la ficha publica. La pestana `Google` del portal
permite conectar Calendar, Business Profile y Workspace, comprobar el estado y
sincronizar Places.

Capacidades:

- Places API con snapshot local y aplicacion opcional a los datos del negocio.
- Calendar FreeBusy, creacion de eventos y sincronizacion de reservas locales.
- Business Profile: cuentas, ubicaciones, cambios validados, resenas,
  respuestas con aprobacion humana y metricas de rendimiento.
- Workspace Admin SDK: alta de usuarios con dry-run y confirmacion explicita.
- Mensajes de solicitud de resena.

Rutas principales:

```text
GET  /api/google/oauth/start?businessId=...&features=calendar,business-profile,workspace
GET  /api/google/oauth/callback
GET  /api/businesses/{id}/google
GET  /api/businesses/{id}/google/diagnostics
POST /api/businesses/{id}/google/disconnect
POST /api/businesses/{id}/google/place/sync
POST /api/businesses/{id}/google/calendar/freebusy
POST /api/businesses/{id}/google/calendar/events
POST /api/businesses/{id}/google/calendar/sync-booking/{bookingId}
GET  /api/businesses/{id}/google/business/accounts
GET  /api/businesses/{id}/google/business/locations
PATCH /api/businesses/{id}/google/business/location
GET  /api/businesses/{id}/google/business/reviews
POST /api/businesses/{id}/google/business/reviews/reply
GET  /api/businesses/{id}/google/business/performance
GET|POST|PATCH|DELETE /api/businesses/{id}/google/business/place-actions
POST /api/businesses/{id}/google/workspace/users
POST /api/businesses/{id}/google/review-request
```

Alta, variables y pasos que requieren intervencion humana:
[Google Cloud Setup](docs/operaciones/GOOGLE_CLOUD_SETUP.md).

## Backend Google legacy

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

La integracion productiva vive en el servidor principal. Este ejemplo se
conserva como referencia aislada y compatibilidad.

Nota: la creacion de correo profesional debe hacerse con Google Workspace del dominio del cliente y permisos de administrador. No se crean cuentas Gmail personales para clientes.

## Descubre tu zona

El módulo premium de recomendaciones locales usa Supabase/PostgreSQL, Overpass, Wikidata, Wikipedia, Wikimedia Commons y Leaflet. No realiza llamadas a modelos de lenguaje. Los extractos documentales se guardan una vez y las tarjetas muestran atribución visible cuando la fuente es Wikipedia. Para POI de OSM sin foto, contrasta páginas e imágenes cercanas mediante nombre y coordenadas; las coincidencias débiles y los recursos de marca (logos, escudos o SVG) se descartan. La selección pública pondera calidad documental, imagen, interés turístico, diversidad y distancia, en ese orden de conjunto, en lugar de limitarse a los puntos más próximos.

Preparación y comprobación:

```powershell
npm.cmd run migrate:zone-discovery
npm.cmd run test:zone-discovery
npm.cmd run test:zone-route-browser
```

La primera activación desde `Portal del cliente > Tu zona` geocodifica el negocio, carga y cachea POIs dentro del radio configurado, enriquece los que tienen entidad documental y recalcula el grafo de afinidad. El toggle parte desactivado y el CTA público solo aparece cuando existen al menos tres recomendaciones.

Desde `Acceder como desarrollador > Laboratorio de zona` se puede colocar un punto haciendo clic o arrastrando el marcador, usar la geolocalización del navegador y cambiar el radio para generar una previsualización real. Este flujo usa `POST /api/zone-discovery/preview`, requiere acceso de desarrollador y no modifica la ubicación ni la configuración de ningún negocio.

Endpoints principales:

```text
GET  /api/public/{business}/zone
POST /api/public/{business}/zone/events
GET  /api/businesses/{id}/zone
PUT  /api/businesses/{id}/zone/settings
POST /api/businesses/{id}/zone/refresh
GET  /api/businesses/{id}/zone/metrics
POST /api/zone-discovery/preview
POST /api/zone/route
```

### Modo Ruta

En la experiencia pública, cada tarjeta se puede añadir a una ruta. Con dos o
más paradas aparece `Planear ruta`: primero explica el uso de la ubicación y
solo entonces solicita el permiso del navegador. Si no hay permiso, el usuario
coloca y ajusta un pin manual. La coordenada vive únicamente en memoria durante
la sesión y no se escribe en la base de datos.

`POST /api/zone/route` valida entre 2 y 6 paradas, aplica nearest-neighbor y
2-opt, consulta el perfil OSRM correspondiente y procesa geometría, tiempos y
alternativas. La panorámica está disponible para pie y bicicleta y puede añadir
hasta dos puntos de paso cercanos. Si OSRM no responde, devuelve una línea
geodésica con aviso explícito; si una parada no es alcanzable, devuelve cuáles
se pueden excluir antes de recalcular.

La infraestructura autoalojada y el preprocesado separado de coche, pie y bici
están en [`infra/osrm/README.md`](infra/osrm/README.md). Para una aceptación
completa de producción hay que preparar el extracto de España, arrancar los tres
contenedores y configurar las variables `OSRM_*_URL` de `.env.example`.
