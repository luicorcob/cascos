# Arquitectura frontend v2

Estado: **completada el 12 de junio de 2026**.

Objetivo: reducir el riesgo de cambios en el Studio y mejorar la experiencia
de edicion antes de retomar pilotos o ventas.

## Fase 1 - Estado, datos y utilidades

- [x] Extraer utilidades puras a `src/studio/core-utils.js`.
- [x] Extraer historial y autoguardado a `src/studio/state-controller.js`.
- [x] Extraer cliente API y cache a `src/studio/data-client.js`.
- [x] Recuperar borradores automaticamente al abrir el Studio.
- [x] Extender deshacer y rehacer a cambios del formulario.

## Fase 2 - Renderizado y exportacion

- [x] Extraer el renderizador a `src/studio/renderer.js`.
- [x] Extraer la exportacion standalone a `src/studio/exporter.js`.
- [x] Mantener una unica composicion para preview y exportacion.
- [x] Probar HTML generado, endpoints publicos, privacidad y schema.

## Fase 3 - Experiencia del editor

- [x] Mostrar estado de autoguardado.
- [x] Anadir atajos globales de deshacer y rehacer.
- [x] Permitir subir y bajar secciones.
- [x] Permitir ocultar y mostrar bloques desde el gestor de orden.
- [x] Persistir el orden en borradores, JSON, API y exportacion.

## Fase 4 - Calidad y sistema visual

- [x] Extraer presets, paletas y packs a `src/studio/catalog.js`.
- [x] Crear validacion de entrega en `src/studio/validation.js`.
- [x] Marcar campos con errores y bloquear exportaciones invalidas.
- [x] Crear pruebas unitarias y contractuales del Studio.
- [x] Crear una guarda arquitectonica para limitar `src/app.js`.
- [x] Verificar arranque real en Chrome.

## Comandos de aceptacion

```powershell
npm.cmd run check
npm.cmd run test:studio
npm.cmd run smoke:pilot
npm.cmd run test:google
```

## Resultado

`src/app.js` pasa de aproximadamente 239 KB a 132 KB. El controlador principal
ya no contiene catalogo visual, utilidades, estado, cliente de datos,
validacion, renderizado ni exportacion.

## Extension - Edicion visual v1

- [x] Editar textos simples y repetidos directamente desde la preview.
- [x] Integrar la edicion directa con historial y autoguardado.
- [x] Crear biblioteca de bloques para portada, servicios, galeria, resenas y contacto.
- [x] Persistir variantes en borradores, JSON, API y exportacion.
- [x] Crear gestor local de medios con compresion, archivos y URLs reutilizables.
- [x] Validar las tres funciones con una prueba de navegador automatizada.

Esta primera extension abrio el camino para ampliar el tratamiento de imagenes
y los elementos editables.

## Extension - Edicion visual v2

- [x] Editar imagenes, encuadres, CTA y enlaces desde la preview.
- [x] Mover y ocultar secciones directamente sobre el lienzo.
- [x] Persistir texto alternativo y posicion de imagen en negocio y exportacion.
- [x] Mostrar dimensiones, peso aproximado y avisos de resolucion en medios.
- [x] Guardar y aplicar composiciones sin modificar contenidos del negocio.
- [x] Descargar y leer el HTML final desde la prueba de navegador.
- [x] Confirmar que el HTML entregado no contiene controles ni metadatos internos del Studio.

La siguiente etapa recomendada es probar el flujo con personas no tecnicas,
permitir duplicar contenido y preparar una entrega empaquetada con activos.
