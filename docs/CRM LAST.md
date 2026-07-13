# PROMPT MAESTRO — Implementación CRM comercial DLS Studio (Sección 5)
##LAS RUTAS DEL TEXTO PUDEN ESTAR MAL EH REVISALAS 
## Rol y reglas de trabajo

Eres el desarrollador encargado de implementar la evolución CRM de DLS Studio descrita en este documento. Ya conoces la arquitectura del proyecto (Node.js ES modules, API en `server/api`, persistencia JSON en `data/business-db.json` con opción PostgreSQL vía `pg`, frontend vanilla HTML/CSS/JS con Lenis, Splitting.js, VanillaTilt, Atropos, Open Props).

Reglas obligatorias:

1. **No improvises geometría ni estructura de datos.** Si un campo, estado o endpoint no está definido explícitamente en este documento, pregunta antes de inventarlo.
2. **Una tarea = un commit.** No mezcles tareas de bloques distintos en el mismo cambio.
3. **Cada tarea incluye:** modelo de datos, endpoints API, cambios de UI y criterios de aceptación. No entregues una tarea si no cumple los cuatro puntos.
4. **Reutiliza lo existente.** Antes de crear una tabla/colección nueva, comprueba si ya existe un campo equivalente en `business-db.json` (contactos, actividades, tags, valueEstimate, etc.) y extiéndelo en vez de duplicarlo.
5. **Mantén compatibilidad hacia atrás.** Los contactos, reservas y pedidos existentes deben seguir funcionando sin migración destructiva. Si hace falta migrar datos, escribe un script de migración idempotente en `scripts/`.
6. **JSON primero, PostgreSQL después.** Implementa siempre contra el store JSON local primero; si existe capa `pg`, replica el cambio de esquema allí también.
7. **Sigue el orden de fases.** No empieces la Fase 2 sin cerrar los criterios de aceptación de la Fase 1, salvo que se indique lo contrario.
8. **Al terminar cada tarea, resume:** qué archivos tocaste, qué endpoints añadiste/modificaste, y qué falta (si algo queda pendiente).

---

## FASE 1 — CRM v1 práctico (objetivo: que ningún lead se pierda)

### Tarea 1.1 — Pipeline Kanban real

**Modelo de datos:**
- Reutilizar el campo `status` existente del contacto (new, contacted, waiting, reserved, won, lost, customer) como columnas del Kanban. No crear un campo de estado paralelo.
- Añadir campo `priority` al contacto: `alta | media | baja` (default `media`).
- Añadir campo `order` (número) por contacto dentro de su columna, para persistir el orden manual dentro de cada estado.

**API:**
- `GET /api/businesses/:id/contacts/pipeline` → devuelve contactos agrupados por `status`, cada grupo con `count` y `totalValueEstimate` (suma de `valueEstimate`).
- `PATCH /api/businesses/:id/contacts/:contactId/pipeline` → body `{ status, order }`. Cambia estado y/o posición. Debe registrar el cambio en el historial de estado ya existente.

**UI:**
- Nueva vista `pages/pipeline.html` (o pestaña dentro de `business-dashboard.html`, tab "Leads").
- Columnas = estados. Cada columna muestra: nombre del estado, nº de tarjetas, valor total sumado.
- Tarjeta = nombre del contacto, fuente, `valueEstimate`, próxima acción (si existe, ver Tarea 1.2), badge de prioridad.
- Drag and drop entre columnas y dentro de la misma columna (reordenar). Al soltar, llamar al PATCH.
- Sin librerías nuevas de terceros para el drag and drop salvo que ya exista una en el proyecto; si hace falta una, proponerla antes de instalarla.

**Criterios de aceptación:**
- Arrastrar una tarjeta cambia su estado en la base de datos y se refleja en el historial del contacto.
- Reordenar dentro de la misma columna persiste el orden tras recargar la página.
- El total en cabecera de columna es correcto tras cualquier cambio.

---

### Tarea 1.2 — Próxima actividad

**Modelo de datos:**
- Nuevo objeto `nextAction` embebido en el contacto (no colección aparte):
  ```
  nextAction: {
    type: "llamada" | "whatsapp" | "email" | "reunion" | "enviar_propuesta" | "revisar_reserva",
    dueDate: ISODate,
    status: "pendiente" | "hecha" | "vencida",
    note: string (opcional)
  }
  ```
- Un contacto tiene como máximo una `nextAction` activa a la vez. Al marcarla "hecha", se archiva en el timeline (Tarea 1.6) y `nextAction` queda `null` hasta que se cree otra.

**API:**
- `POST /api/businesses/:id/contacts/:contactId/next-action` → crea o reemplaza la `nextAction` activa.
- `PATCH /api/businesses/:id/contacts/:contactId/next-action` → cambia `status` (marcar hecha).
- `GET /api/businesses/:id/next-actions?filter=hoy|vencidas|sin-accion` → listas filtradas.
- Job/cálculo (puede ser al vuelo en el GET, no hace falta cron): si `dueDate < hoy` y `status = pendiente`, se devuelve como `vencida` sin necesidad de un proceso en background.

**UI:**
- En la tarjeta del Kanban: chip con tipo de acción + fecha, en rojo si vencida.
- En la ficha de contacto: selector de tipo, fecha, botón "marcar hecha".
- Nueva vista o tab "Hoy" dentro del portal: tres listas — Hoy, Vencidas, Sin próxima acción.

**Criterios de aceptación:**
- Un contacto sin `nextAction` aparece en "Sin próxima acción".
- Cambiar `dueDate` al pasado hace que aparezca en "Vencidas" sin acción manual adicional.
- Marcar "hecha" la retira de las tres listas y queda registrada en el timeline.

---

### Tarea 1.3 — Lead scoring básico

**Modelo de datos:**
- Campo calculado `score` (número 0-100) y `scoreLabel` (`caliente | templado | frio | perdido`) en el contacto. Se recalcula, no se edita a mano.
- Señales y pesos (fijos para v1, no configurables todavía):
  - Teléfono presente: +10
  - Email presente: +10
  - Formulario propio enviado (no chatbot): +15
  - Chatbot usado: +10
  - Click en reserva registrado (evento existente en reportes): +15
  - `valueEstimate` por encima de la mediana de negocio: +15
  - Interacción en los últimos 3 días: +15
  - Sin interacción en más de 14 días: -20
  - Estado `lost`: fuerza `scoreLabel = perdido` independientemente del número.
- Umbrales: `>=70` caliente, `40-69` templado, `<40` frío (salvo `lost`).

**API:**
- Recalcular `score` en cada escritura relevante del contacto (nueva actividad, cambio de estado, nuevo evento asociado). No exponer endpoint de recálculo manual salvo para debug (`POST /api/businesses/:id/contacts/:contactId/recalculate-score`, solo uso interno/admin).
- Incluir `score` y `scoreLabel` en las respuestas de listado de contactos y pipeline.

**UI:**
- Badge de color en la tarjeta del Kanban y en la ficha de contacto (caliente=rojo, templado=naranja, frío=azul, perdido=gris).
- Filtro por `scoreLabel` en la vista de contactos.

**Criterios de aceptación:**
- Cambiar cualquier señal listada recalcula el score inmediatamente y de forma consistente con la fórmula.
- Un contacto marcado `lost` siempre muestra `perdido` aunque el número diga otra cosa.

---

### Tarea 1.4 — Motivos de pérdida

**Modelo de datos:**
- Campo `lostReason` en el contacto, enum cerrado: `precio | no_responde | ya_tiene_proveedor | fuera_de_zona | pospuesto | no_encaja | competencia`.
- Obligatorio cuando `status` pasa a `lost`. Si no se envía, la API rechaza el cambio de estado (400).

**API:**
- El PATCH de pipeline (Tarea 1.1) exige `lostReason` cuando `status = "lost"`.
- `GET /api/businesses/:id/reports/lost-reasons` → conteo agrupado por motivo, para el dashboard de la Fase 4.

**UI:**
- Al arrastrar una tarjeta a la columna "lost" (o cambiar estado manualmente a perdido), mostrar un modal obligatorio de selección de motivo antes de confirmar el cambio.

**Criterios de aceptación:**
- No es posible marcar un contacto como `lost` sin motivo, ni desde el Kanban ni desde la ficha.
- El motivo queda visible en el timeline del contacto.

---

### Tarea 1.5 — Fusión de duplicados

**Modelo de datos:**
- No se crea campo nuevo. Se añade lógica de detección: mismo `phone` normalizado o mismo `email` normalizado dentro del mismo negocio.
- Al fusionar, el contacto superviviente conserva: historial de estados, actividades, reservas y pedidos combinados y ordenados cronológicamente. El contacto duplicado se marca `merged: true` y `mergedInto: <id>` en vez de borrarse (soft merge, no destructivo).

**API:**
- `GET /api/businesses/:id/contacts/duplicates` → lista de pares/grupos candidatos a duplicado.
- `POST /api/businesses/:id/contacts/merge` → body `{ survivorId, duplicateIds: [] }`. Ejecuta la fusión.
- En los puntos de creación de contacto (formulario web, chatbot, reserva pública), antes de crear un contacto nuevo, comprobar si ya existe uno con mismo teléfono/email en ese negocio; si existe, actualizar el existente en lugar de crear uno nuevo.

**UI:**
- Vista o sección "Posibles duplicados" en el portal, con botón "Fusionar" por grupo detectado.

**Criterios de aceptación:**
- Enviar el mismo formulario dos veces con el mismo teléfono no crea dos contactos.
- Fusionar dos contactos conserva todo el historial combinado sin pérdida de datos.

---

### Tarea 1.6 — Timeline unificado

**Modelo de datos:**
- No es una tabla nueva: es un endpoint agregador que junta, ordenado por fecha, lo que ya existe: notas, actividades, cambios de estado, `nextAction` completadas, reservas, mensajes de chatbot, pedidos, recordatorios enviados y eventos relevantes de reportes.

**API:**
- `GET /api/businesses/:id/contacts/:contactId/timeline` → array unificado, cada item con `{ type, date, summary, refId }`.

**UI:**
- En la ficha de contacto, sustituir o complementar la lista actual de "actividades" por este timeline unificado, en orden cronológico inverso.

**Criterios de aceptación:**
- El timeline de un contacto con reservas, pedidos y notas muestra todo mezclado y ordenado por fecha sin duplicar información ya visible en otras pestañas.

---

## FASE 2 — Ventas y propuestas (objetivo: convertir oportunidades en dinero medible)

*(No empezar hasta cerrar Fase 1)*

### Tarea 2.1 — Presupuestos/propuestas
- Modelo: nueva entidad `proposal` ligada a `contactId` y `businessId`: `{ id, package: "presencia_local"|"conversion_pro"|"growth_local"|"custom", setupPrice, monthlyPrice, conditions, expiresAt, status: "borrador"|"enviada"|"vista"|"aceptada"|"rechazada"|"caducada" }`.
- API: CRUD de propuestas + endpoint de exportación (`GET /api/.../proposals/:id/export?format=html|pdf`).
- UI: crear propuesta desde la ficha del lead, listado de propuestas por negocio, cambio de estado manual + automático (caducada si `expiresAt` pasado).
- Criterios: una propuesta aceptada dispara la Tarea 2.5 (conversión automática, ver Fase 3).

### Tarea 2.2 — Plantillas de seguimiento
- Modelo: colección `messageTemplates` por negocio (o globales con override por negocio): primer contacto, envío de demo, seguimiento 48h, envío de propuesta, reactivación de lead frío, solicitud de reseña.
- API: CRUD de plantillas + endpoint para "renderizar" plantilla con datos del contacto (placeholders tipo `{{nombre}}`).
- UI: selector de plantilla desde la ficha de contacto, con vista previa antes de copiar/enviar.

### Tarea 2.3 — Forecast comercial
- Cálculo: `valueEstimate * probabilidad_por_estado` (definir probabilidad fija por estado, ej. new=10%, contacted=25%, waiting=40%, reserved=60%, won=100%, lost=0%).
- API: `GET /api/businesses/:id/reports/forecast?month=YYYY-MM`.
- UI: bloque de forecast en el dashboard de reportes existente, no una página nueva.

---

## FASE 3 — Automatización (objetivo: reducir trabajo manual)

*(No empezar hasta cerrar Fase 2)*

### Tarea 3.1 — Reglas simples
Implementar como triggers síncronos en los puntos donde ya se escribe el dato (no cron aparte salvo el caso de "7 días sin actividad", que sí necesita un job programado):
- Lead nuevo → crear `nextAction` "Responder hoy" automáticamente.
- Demo publicada → crear `nextAction` "Seguimiento en 48h".
- Lead sin actividad 7 días → marcar `scoreLabel = frio` o crear tarea de revisión (job diario).
- Reserva completada → crear sugerencia (no automática, ver Tarea 3.2) de "pedir reseña".
- Propuesta aceptada (Tarea 2.1) → cambiar `status` del contacto a `customer` automáticamente.

### Tarea 3.2 — Bandeja diaria
- API: `GET /api/businesses/:id/inbox` → agrega leads nuevos, actividades vencidas, reservas de hoy, propuestas pendientes, clientes sin seguimiento reciente.
- UI: nueva vista o tab "Bandeja" como página de aterrizaje del portal.

### Tarea 3.3 — SLA comercial
- Medir `firstResponseTime` = diferencia entre creación del contacto y primera actividad/cambio de estado registrado.
- API: `GET /api/businesses/:id/reports/sla` → tiempo medio de primera respuesta y lista de leads sin tocar en más de X horas (configurable, default 24h).

---

## FASE 4 — Reporting avanzado (objetivo: dirigir el negocio con datos)

*(No empezar hasta cerrar Fase 3)*

### Tarea 4.1 — Dashboard comercial
- Un único endpoint agregador `GET /api/businesses/:id/reports/commercial-dashboard` que reutiliza los endpoints ya creados en fases anteriores (lost-reasons, forecast, sla) más: leads por fuente, conversión por estado, actividades realizadas, propuestas enviadas/aceptadas, reservas convertidas a cliente.
- UI: extender la vista de reportes existente, no crear una página nueva desde cero.

### Tarea 4.2 — Atribución
- Modelo: añadir `utmSource`, `utmMedium`, `utmCampaign` al contacto y a los eventos de conversión ya existentes, capturados en el momento de creación desde la web/formulario/chatbot.
- API: incluir estos campos en los endpoints de eventos y contactos ya existentes.

### Tarea 4.3 — Calidad de datos
- API: `GET /api/businesses/:id/reports/data-quality` → contactos sin teléfono/email, leads sin `nextAction`, clientes sin consentimiento, negocios sin enlace de reseñas o reserva.
- UI: panel de avisos en el dashboard del negocio o del admin general.

---

## Orden de entrega recomendado

1. Fase 1 completa, tarea por tarea, en el orden 1.1 → 1.6.
2. Confirmación de que los criterios de aceptación de Fase 1 se cumplen antes de tocar Fase 2.
3. Fase 2 en orden 2.1 → 2.3.
4. Fase 3 en orden 3.1 → 3.3.
5. Fase 4 en orden 4.1 → 4.3.

Si en cualquier tarea el modelo de datos o el endpoint definido aquí choca con algo ya existente en el código real, detente y pregunta antes de sobrescribir.
