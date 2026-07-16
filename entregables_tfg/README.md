# Entregables de la memoria técnica del TFG

Este directorio documenta el estado comprobado del repositorio en el commit `8b123783eb2d8750aafdfa4a1e58d340ed82f6a3` (16 de julio de 2026). No se ha modificado el código de la aplicación. Los únicos archivos añadidos son documentación, evidencias, datos ficticios y utilidades de generación documental.

## Entregables

- `auditoria_tecnica.md`: informe previo de auditoría con trazabilidad a código, configuración, pruebas y ejecución.
- `memoria_tfg.md`: fuente editable de la memoria.
- `memoria_tfg.html`: versión maquetada y editable en navegador.
- `memoria_tfg.pdf`: PDF final de 42 páginas para revisión académica.
- `capturas/originales/`: dieciséis capturas reales de la aplicación ejecutada.
- `anexos/inventario_capturas.md`: catálogo de figuras, secciones y evidencias.
- `anexos/capturas_no_obtenidas.md`: flujos que no pudieron capturarse y causa.
- `anexos/afirmaciones_no_verificables.md`: extremos que requieren evidencia externa o confirmación del autor.
- `anexos/contradicciones_documentacion.md`: diferencias entre el estado actual y documentación histórica.
- `anexos/resultados_pruebas.md`: matriz de comprobaciones realizadas.
- `anexos/matriz_evidencias.md`: correspondencia entre afirmaciones y fuentes.
- `evidencias/fixture-capturas.json`: datos completamente ficticios usados en las capturas.
- `evidencias/capturar_tfg.mjs`: recorrido reproducible de captura aislada.
- `revision_pdf/`: render de las 42 páginas empleado para la comprobación visual.
- `revision_pdf/informe_revision.md`: resultado y alcance de la revisión página por página.

## Convención de evidencia

- **[CÓDIGO]**: afirmación observada directamente en código conectado a un flujo.
- **[CONFIGURACIÓN]**: afirmación respaldada por manifiestos o configuración.
- **[PRUEBAS]**: afirmación respaldada por una prueba ejecutada.
- **[EJECUCIÓN]**: comportamiento observado al ejecutar el sistema.
- **[INFERENCIA]**: conclusión razonable, indicada como tal.
- **[HISTÓRICA]**: afirmación antes válida o prevista, pero no representativa del estado actual.
- **[SOLO DOCUMENTACIÓN]**: afirmación sin respaldo en el runtime actual.
- **[NO VERIFICABLE]**: requiere servicios, credenciales o evidencia externa no disponible.

## Reproducibilidad y privacidad

Las capturas se generaron con Node.js, el servidor real del repositorio y Chrome en modo sin interfaz. El proceso fuerza persistencia JSON, bloquea el uso de PostgreSQL remoto, no carga el `.env` del proyecto y usa nombres, teléfonos, correos y dominios de prueba. Las imágenes externas que aparecen en las webs de demostración son recursos referenciados por el propio renderer; no se muestran credenciales ni datos personales reales.

La portada conserva marcadores pendientes para autor, tutor, titulación y centro porque esos metadatos no pueden deducirse del repositorio.
