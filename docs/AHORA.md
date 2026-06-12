# Ahora

Ultima actualizacion: 12 de junio de 2026.

Este es el panel de mando canonico de LocalLift. Las ventas y el despliegue
publico quedan pospuestos mientras se madura el producto.

## Objetivo activo

Convertir LocalLift Studio en una herramienta de creacion web mantenible,
segura al editar y suficientemente clara para trabajar sin improvisar.

Resultados que definen el exito de esta etapa:

- Arquitectura frontend modular y protegida por pruebas.
- Edicion con autoguardado, historial y orden configurable de secciones.
- Preview y exportacion generadas por el mismo renderizador.
- Validacion visible que impide exportar entregas con errores criticos.
- Flujo principal verificado en navegador real y por pruebas automatizadas.

Plan vinculante:
[`activo/ARQUITECTURA_FRONTEND_V2.md`](activo/ARQUITECTURA_FRONTEND_V2.md).

## Fase actual

**Maduracion de producto: Edicion visual v2 completada.**

El Studio ya se ha dividido en catalogo, utilidades, estado, datos,
validacion, renderizado y exportacion. `src/app.js` queda como orquestador de
interfaz e interacciones. La preview permite editar contenido, imagenes,
encuadres, enlaces y secciones; tambien guarda composiciones reutilizables y
verifica la entrega HTML real.

## Siguientes acciones, en orden

1. Realizar sesiones de uso con personas no tecnicas y corregir fricciones.
2. Permitir duplicar secciones y anadir elementos repetidos desde la preview.
3. Crear recorte libre de imagenes y almacenamiento de activos fuera de localStorage.
4. Preparar una entrega empaquetada con HTML, activos y ficha de cambios.
5. Ejecutar una auditoria completa de accesibilidad y navegacion por teclado.
6. Revisar entonces si el producto esta listo para retomar pilotos o ventas.

## Verificacion obligatoria

Antes de cerrar cualquier cambio del Studio:

```powershell
npm.cmd run check
npm.cmd run test:studio
npm.cmd run smoke:pilot
```

Para cambios de Google:

```powershell
npm.cmd run test:google
```

## Preparado y verificado

- `src/app.js` reducido de aproximadamente 239 KB a 132 KB.
- Catalogo visual separado en `src/studio/catalog.js`.
- Utilidades puras separadas y probadas.
- Estado, historial y autoguardado separados y probados.
- Cliente de datos y cache de negocio separados y probados.
- Renderizador y exportador separados con prueba contractual.
- Validacion de entrega con errores, avisos y bloqueo de exportacion.
- Orden configurable de secciones compartido por preview y exportacion.
- Edicion directa de textos y listas desde la preview con historial.
- Edicion directa de imagenes, encuadres, CTA, enlaces, telefono y email.
- Controles sobre la preview para subir, bajar y ocultar secciones.
- Biblioteca visual con 13 variantes para cinco tipos de bloque.
- Plantillas de composicion integradas y guardadas localmente sin perder contenido.
- Gestor local de medios con compresion, dimensiones, texto alternativo y limites.
- Guarda arquitectonica que limita el crecimiento de `src/app.js`.
- Recorrido visual y HTML exportado verificados de extremo a extremo en Chrome headless.
- HTML entregado limpio, sin controles ni metadatos internos del editor.
- Smoke test integral y pruebas Google aprobadas.

## Pospuesto

- Prospeccion, llamadas y cierre de clientes.
- Despliegue publico de Fase 0.
- Medio de cobro, revision legal y fiscal comercial.
- Migracion a PostgreSQL o servicios que exijan nuevas cuentas externas.
- Funciones que no mejoren directamente la experiencia de crear y entregar
  webs.
