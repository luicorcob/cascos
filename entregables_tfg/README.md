# Entregables de la memoria técnica del TFG

Este directorio documenta el estado de trabajo del 23 de julio de 2026: base Git `9eba88695ae39af83ab40a147f38ee88dc15a77a` más la refactorización modular descrita en la memoria. El código sí ha evolucionado desde el primer corte documental; por eso la memoria actual diferencia la evidencia visual histórica del estado técnico vigente.

## Entregables

- `memoria_tfg.md`: fuente editable y referencia principal actual.
- `memoria_tfg.html`: versión maquetada para navegador.
- `memoria_tfg.pdf`: PDF regenerado desde la fuente editable.
- `auditoria_tecnica.md`: auditoría histórica del 16 de julio; se conserva para trazabilidad y no prevalece sobre la memoria actual.
- `capturas/originales/`: dieciséis capturas reales del corte visual del 16 de julio.
- `anexos/inventario_capturas.md`: catálogo de figuras, secciones y evidencias.
- `anexos/capturas_no_obtenidas.md`: flujos que no pudieron capturarse y causa.
- `anexos/afirmaciones_no_verificables.md`: extremos que requieren evidencia externa o confirmación del autor.
- `anexos/contradicciones_documentacion.md`: diferencias entre cortes históricos y estado actual.
- `anexos/resultados_pruebas.md`: matriz de comprobaciones del 23 de julio.
- `anexos/matriz_evidencias.md`: correspondencia entre afirmaciones y fuentes actuales.
- `evidencias/fixture-capturas.json`: datos completamente ficticios usados en las capturas.
- `evidencias/capturar_tfg.mjs`: recorrido reproducible de captura aislada.
- `revision_pdf/`: render por páginas y revisión visual del último PDF generado.

## Convención de evidencia

- **[CÓDIGO]**: afirmación observada directamente en código conectado a un flujo.
- **[CONFIGURACIÓN]**: afirmación respaldada por manifiestos o configuración.
- **[PRUEBAS]**: afirmación respaldada por una prueba ejecutada.
- **[EJECUCIÓN]**: comportamiento observado al ejecutar el sistema.
- **[INFERENCIA]**: conclusión razonable, indicada como tal.
- **[HISTÓRICA]**: afirmación o imagen correspondiente a un corte anterior.
- **[SOLO DOCUMENTACIÓN]**: afirmación sin respaldo en el runtime actual.
- **[NO VERIFICABLE]**: requiere servicios, credenciales o evidencia externa no disponible.

## Reproducibilidad y privacidad

Las capturas se generaron con Node.js, el servidor real y Chrome sin interfaz. El proceso fuerza persistencia JSON, anula conexiones PostgreSQL remotas, no carga el `.env` y usa nombres, teléfonos, correos y dominios de prueba. No muestran credenciales ni datos personales reales.

Las figuras siguen demostrando los flujos presentes en ellas, pero no cubren la landing, Control DLS, el portal cliente separado, CRM 2 o Descubre tu zona, añadidos después. Esas capacidades se acreditan mediante código y pruebas hasta que se renueve el juego visual.

La portada conserva marcadores pendientes para autor, tutor, titulación y centro porque esos metadatos no pueden deducirse del repositorio.
