# Arquitectura modular v3

Estado: **completada y verificada el 23 de julio de 2026**.

Este documento describe la estructura vigente. Conserva como antecedente
[`ARQUITECTURA_FRONTEND_V2.md`](ARQUITECTURA_FRONTEND_V2.md), pero sustituye sus
métricas y su mapa de responsabilidades.

## Objetivos y resultado

- `src/app.js` vuelve a ser un orquestador: baja de 253.865 a 163.228 bytes y
  cumple el límite de 180.000 bytes.
- `server/server.mjs` queda como raíz de composición de 6.472 bytes; el registro
  y orden de las 39 familias de rutas vive en `server/http/api-router.mjs`.
- La comprobación sintáctica deja de enumerar archivos a mano. Un único script
  descubre y valida todos los módulos JavaScript bajo `src/`, `server/`,
  `cloudflare/` y `examples/`.
- Las fronteras nuevas tienen pruebas unitarias/estructurales y forman parte de
  `npm run test:studio`, `npm run test:architecture` y `npm run check`.

## Fronteras del Studio

| Módulo | Responsabilidad |
|---|---|
| `commerce-model.js` | Normalización de productos, envíos, URLs y configuración de comercio. |
| `business-model.js` | Valores por defecto, importación, variantes, metadatos y estilos persistidos. |
| `public-runtime.js` | Formularios públicos, reservas, atribución, telemetría y endpoints por negocio. |
| `chatbot-controller.js` | Widget, conversación local/remota y captura de leads. |
| `storefront-controller.js` | Catálogo, carrito, cotización, entrega y checkout configurable. |
| `site-image-controller.js` | Packs visuales, Radar → imágenes, proveedores y biblioteca de medios. |
| `intro-controller.js` | Hub inicial, ayuda, navegación y login de cliente. |
| `delivery-controller.js` | Exportación, publicación de demos y paquete de entrega. |
| `zip-archive.js` | Creación ZIP y CRC32 sin dependencias externas. |
| `renderer.js` / `exporter.js` | Composición compartida y documento standalone. |
| `app.js` | Estado de pantalla y coordinación entre módulos. |

Los módulos siguen el patrón existente de `window.LocalLiftStudio` porque el
frontend se sirve sin bundler y el renderer se reutiliza desde otras páginas.
Las fábricas reciben dependencias explícitas, evitando que cada módulo lea o
modifique el estado del orquestador de forma implícita.

## Frontera HTTP

`server/http/api-router.mjs` contiene dos registros ordenados:

- rutas públicas que deben resolverse antes de la autenticación administrativa;
- rutas protegidas, despachadas después de aplicar guards, rate limit y, cuando
  corresponde, autenticación admin.

El orden conserva las excepciones necesarias —salud, login, stock y
recordatorios públicos— y evita que añadir una API obligue a ampliar una
cadena condicional en el servidor principal.

## Comandos de aceptación

```powershell
npm.cmd run check
npm.cmd run test:architecture
npm.cmd run test:studio
npm.cmd run smoke:pilot
```

La prueba larga `test:studio-browser` continúa fallando en este entorno por
`Target crashed`; no forma parte del resultado positivo de esta
refactorización y permanece como deuda separada.

## Reglas para cambios futuros

1. `app.js` no debe recuperar lógica de dominio, transporte o serialización.
2. Un nuevo flujo con estado propio debe exponerse mediante una fábrica y una
   API pequeña.
3. Toda familia nueva de rutas se registra en `api-router.mjs` con nombre único.
4. No se añaden archivos manualmente al script de sintaxis: el descubrimiento es
   automático.
5. Los límites de 180 KB para `app.js` y 12 KB para `server.mjs` no se elevan
   para ocultar una regresión.
6. Las páginas empresariales deben ser el siguiente frente de modularización:
   `src/business/dashboard.js` sigue concentrando demasiadas responsabilidades.
