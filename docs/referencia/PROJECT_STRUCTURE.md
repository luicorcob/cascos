# Project structure

Funcion: mapa tecnico de referencia. Las prioridades actuales se consultan en
[`../AHORA.md`](../AHORA.md).

```text
.
|-- index.html
|-- README.md
|-- .env.example
|-- Dockerfile
|-- render.yaml
|-- src/
|   |-- app.js
|   |-- business/
|   |-- shared/
|   |-- studio/
|   `-- styles/
|-- pages/
|-- server/
|   |-- api/
|   |-- http/
|   |-- lib/
|   `-- scripts/
|-- examples/
|-- assets/
|-- data/
`-- docs/
    |-- AHORA.md
    |-- README.md
    |-- activo/
    |-- ventas/
    |-- producto/
    |-- operaciones/
    `-- referencia/
```

## Convenciones de codigo

- Mantener `index.html` en la raiz como entrada sencilla al Studio.
- Mantener `src/app.js` como orquestador de interfaz; los controladores con
  estado propio no vuelven al archivo central.
- Colocar catalogo, modelos, controladores, estado, datos, validacion,
  renderizado y exportacion en
  `src/studio/`.
- Colocar modulos del portal en `src/business/` y estilos dedicados en
  `src/styles/`.
- Colocar paginas auxiliares de navegador en `pages/`.
- Colocar servicios Node ejecutables en `server/` o `examples/`.
- Colocar datos operativos y copias en `data/`.

## Convenciones de documentacion

- `docs/AHORA.md` es el unico panel de prioridades.
- `docs/activo/` contiene el plan vinculante y trackers vivos.
- `docs/ventas/` contiene material para vender, cobrar y hacer onboarding.
- `docs/producto/` contiene calidad y decisiones funcionales.
- `docs/operaciones/` contiene despliegue, aceptacion y mantenimiento.
- `docs/referencia/` contiene contexto que no crea trabajo activo.

El inventario completo y las reglas de autoridad estan en
[`../README.md`](../README.md).

## Archivos tecnicos principales

- `pages/business-dashboard.html`: portal operativo del negocio.
- `pages/monthly-report.html`: reporte mensual imprimible.
- `src/business/dashboard.js`: carga API, tabs y metricas operativas.
- `src/business/monthly-report.js`: carga y render del reporte.
- `src/shared/api-config.js`: resolucion compartida de la URL de API.
- `src/studio/catalog.js`: demos, presets, paletas y escalas visuales.
- `src/studio/core-utils.js`: utilidades puras de texto, URLs, dinero y datos.
- `src/studio/state-controller.js`: historial y autoguardado.
- `src/studio/layout-library.js`: composiciones reutilizables guardadas localmente.
- `src/studio/media-library.js`: biblioteca local reutilizable de imagenes.
- `src/studio/data-client.js`: cliente API y cache del negocio activo.
- `src/studio/business-model.js`: normalizacion y valores por defecto del negocio.
- `src/studio/commerce-model.js`: productos, envios y configuracion comercial.
- `src/studio/public-runtime.js`: formularios publicos, reservas, eventos y atribucion.
- `src/studio/chatbot-controller.js`: conversacion local/remota y captura de leads.
- `src/studio/storefront-controller.js`: carrito, cotizacion y checkout.
- `src/studio/site-image-controller.js`: packs de imagenes y handoff visual de Radar.
- `src/studio/intro-controller.js`: hub de entrada y acceso de cliente.
- `src/studio/delivery-controller.js`: demo, descargas y paquete de entrega.
- `src/studio/zip-archive.js`: empaquetado ZIP sin dependencias.
- `src/studio/validation.js`: reglas de calidad y entrega.
- `src/studio/renderer.js`: HTML compartido por preview y exportacion.
- `src/studio/exporter.js`: documento HTML standalone y runtime exportado.
- `server/server.mjs`: entrada del backend.
- `server/http/api-router.mjs`: manifiesto y orden de las familias de rutas.
- `server/api/`: endpoints de negocios, contactos, reservas, eventos, salud y
  reportes.
- `server/lib/`: autenticacion, CORS, almacenamiento JSON y rate limiting.
- `server/scripts/`: validacion, seed, restauracion, smoke test y generacion de
  la memoria TFG.
- `.env.example`: plantilla de variables locales y de produccion.
- `render.yaml`: Blueprint de Render con healthcheck y disco persistente.

La arquitectura vigente y sus guardas se documentan en
[`../activo/ARQUITECTURA_MODULAR_V3.md`](../activo/ARQUITECTURA_MODULAR_V3.md).
