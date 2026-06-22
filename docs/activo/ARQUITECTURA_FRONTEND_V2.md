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

`src/app.js` pasa de aproximadamente 239 KB a 156 KB. El controlador principal
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

## Extension - Edicion visual v3

- [x] Anadir elementos repetidos desde controles de seccion en la preview.
- [x] Duplicar, borrar y reordenar servicios, diferenciales, resenas, FAQ y galeria.
- [x] Mantener los controles como DOM dinamico exclusivo del Studio.
- [x] Cubrir las mutaciones con una prueba de navegador en Chrome headless.

## Extension - Equilibrio visual

- [x] Reforzar `Muy visual` para limitar servicios, diferenciales y FAQ visibles.
- [x] Reducir textos largos en hero, introducciones, metricas, reseñas y movil.
- [x] Anadir accion rapida `Escaparate visual` para priorizar imagenes, CTA y prueba social.
- [x] Cubrir el comportamiento con pruebas contractuales de render y navegador.

## Extension - Inspector tipografico

- [x] Guardar estilos por elemento editable en `textStyles`.
- [x] Editar color, opacidad, tamano, peso, cursiva y espaciado desde la preview.
- [x] Renderizar estilos en preview y HTML exportado sin exponer metadatos internos.
- [x] Cubrir persistencia y exportacion con pruebas de renderer y Chrome headless.

## Extension - Secciones duplicables

- [x] Soportar instancias de seccion en `sectionOrder` con claves como `services__copy1`.
- [x] Duplicar secciones completas desde los controles de la preview.
- [x] Eliminar copias desde preview y gestor lateral sin borrar la seccion base.
- [x] Renderizar copias con ids HTML unicos y metadatos internos limpiados en exportacion.
- [x] Cubrir normalizacion, render y flujo real en Chrome headless.

## Extension - Entrega Pro v1

- [x] Anadir accion `Entrega Pro` en la barra superior.
- [x] Generar preflight con estado listo/bloqueado, bloqueos, avisos, checklist y paquete estimado.
- [x] Reutilizar la validacion existente para mantener los mismos bloqueos que la exportacion.
- [x] Cubrir el flujo en Chrome headless.

La siguiente etapa recomendada es probar el flujo con personas no tecnicas,
preparar una entrega empaquetada con HTML, JSON, ficha de cambios y capturas,
y mejorar el tratamiento avanzado de imagenes.
