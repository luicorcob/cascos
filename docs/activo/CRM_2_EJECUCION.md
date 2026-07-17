# CRM 2.0 y suite operativa vertical

Estado: **activo**  
Inicio: **17 de julio de 2026**  
Ultima actualizacion: **17 de julio de 2026**  
Responsable de ejecucion: **DLS**

Este es el documento canonico para evolucionar el dashboard de DLS desde el
CRM comercial actual hasta una plataforma completa de captacion, venta,
operacion y fidelizacion para negocios locales. Sustituye como prioridad activa
al trabajo de arquitectura del Studio, que ya consta como completado en
`ARQUITECTURA_FRONTEND_V2.md`.

No es una lista de ideas. Es el contrato de ejecucion: inventario real,
arquitectura objetivo, orden, dependencias, criterios de aceptacion y registro
de avance.

## 1. Resultado que buscamos

Una persona responsable de un negocio debe poder abrir DLS y, desde un unico
lugar:

1. Saber que requiere atencion hoy.
2. Captar, cualificar y convertir oportunidades sin perder contexto.
3. Conversar por canales reales y medir cada respuesta.
4. Automatizar seguimientos con control, consentimiento y trazabilidad.
5. Pasar de propuesta a aceptacion, cobro, proyecto y factura.
6. Operar reservas, equipo, pedidos e inventario segun su tipo de negocio.
7. Entender clientes, recurrencia, reputacion, ingresos y riesgos.
8. Recibir ayuda de IA sin que la IA ejecute acciones sensibles en silencio.

El dashboard no intentara copiar un CRM horizontal entero. La ventaja de DLS
sera unir CRM, presencia local, reservas, reputacion y operacion en flujos
verticales sencillos.

## 2. Lo que ya tenemos y no se debe duplicar

La investigacion se ha contrastado con el codigo actual. Estas capacidades ya
existen y deben ampliarse, no reimplementarse:

| Area | Capacidad existente | Decision de reutilizacion |
| --- | --- | --- |
| Contactos | Datos de contacto, fuente, UTM first-touch, etiquetas, notas, privacidad, valor estimado y prioridad | El contacto pasa a representar a la persona, no a la venta |
| Pipeline | Kanban con estados, orden manual, valor por columna y motivos de perdida | Se mantiene como compatibilidad y se migra gradualmente a oportunidades |
| Seguimiento | Una `nextAction`, actividades, timeline unificado y bandeja diaria | Se conserva; evolucionara a tareas multiples y asociaciones |
| Inteligencia comercial | Scoring, SLA, forecast, atribucion, calidad de datos e informe mensual | Se recalculara sobre oportunidades sin perder la lectura antigua |
| Propuestas | CRUD, estados, exportacion HTML/PDF y automatizacion al aceptar | Sera la entrada del flujo quote-to-cash |
| Mensajes | Plantillas renderizadas, copiar texto y abrir WhatsApp/email | Las plantillas se conservan; falta envio, recepcion, sincronizacion y estado |
| Automatizacion | Reglas fijas para lead nuevo, demo, inactividad, propuesta aceptada y reseña | Se convierten en plantillas iniciales del motor visual |
| Reservas | Servicios, disponibilidad, bloqueos, estados, recordatorios y Calendar | Se amplian con recursos, capacidad, espera y depositos |
| Operaciones | Proyectos, tareas, archivos, aprobaciones, documentos y portal | Se enlazan con venta, cobro y cliente |
| Hospitality | Facturas, gastos, proveedores, empleados, turnos e inventario | Se normalizan y enlazan con clientes, reservas y permisos |
| Google | Conexion, rendimiento, acciones, listado y respuesta a reseñas | Ya permite crear un Centro de reputacion sin rehacer backend |
| Comunicaciones | Colecciones de hilos y mensajes y una API inicial | Sera el nucleo de la bandeja omnicanal |
| Seguridad | Sesion admin/cliente, CORS, limites, logs y auditoria basica | Se extiende con usuarios, roles y permisos por accion |

## 3. Carencias prioritarias detectadas

### P0 - Cimientos que desbloquean todo

- El estado comercial vive en el contacto. Una persona no puede tener dos
  oportunidades independientes, productos distintos o ciclos de venta
  simultaneos.
- No existen cuentas/empresas ni asociaciones genericas entre personas,
  oportunidades, reservas, propuestas, facturas, proyectos y mensajes.
- Solo hay una proxima accion embebida; faltan tareas multiples, responsables,
  colas y calendarios de equipo.
- El nivel de acceso de empleados se almacena, pero no constituye autorizacion
  efectiva por recurso y accion.
- El consentimiento es demasiado simple para campañas: falta proposito, canal,
  fuente, texto aceptado, fecha, prueba y retirada.

### P1 - Accion comercial

- La mensajeria aun deriva al usuario a otras aplicaciones. Faltan envio real,
  recepcion, estados, adjuntos, asignacion, SLA por conversacion y baja.
- Las automatizaciones son codigo fijo. Faltan disparadores, condiciones,
  esperas, acciones, versiones, logs, reintentos y modo de prueba.
- Faltan secuencias personales de venta y campañas segmentadas de marketing.
- La propuesta no tiene enlace publico, registro de vistas, aceptacion
  verificable, firma, anticipo ni conversion completa a proyecto/factura.

### P2 - Retencion y experiencia

- Falta una ficha Cliente 360 con gasto, visitas, reservas, recurrencia,
  preferencias, incidencias, LTV y RFM.
- Faltan segmentos dinamicos, fidelizacion, bonos, saldo, referidos y campañas
  de reactivacion.
- El backend de reseñas existe, pero falta convertirlo en un flujo visible de
  solicitud, bandeja, respuesta, escalado y medicion.

### P3 - Operacion vertical

- Las reservas no modelan profesional, mesa, sala, recurso, aforo, comensales,
  duracion variable, lista de espera, deposito ni politica de no-show.
- Las facturas de hospitality usan nombre de cliente en vez de una asociacion
  estable.
- Faltan previsiones operativas: ocupacion, demanda, rotacion, personal y stock.

### P4 - Inteligencia

- Falta un brief diario explicativo y una recomendacion de siguiente mejor
  accion.
- El forecast usa probabilidades fijas; falta calibrarlo con el historico real.
- Faltan cohortes, retencion, embudos configurables, objetivos y alertas.
- La IA no debe añadirse como chat decorativo: debe trabajar sobre permisos,
  fuentes citadas, borradores revisables y acciones confirmadas.

## 4. Arquitectura funcional objetivo

### 4.1 Entidades principales

| Entidad | Responsabilidad | Asociaciones clave |
| --- | --- | --- |
| `contact` | Persona y datos de relacion | cuenta, oportunidades, reservas, mensajes, consentimientos |
| `account` | Empresa, hogar, grupo u organizacion | contactos, oportunidades, facturas |
| `pipeline` | Proceso comercial configurable | etapas, oportunidades |
| `deal` | Oportunidad economica independiente | contacto, cuenta, propuestas, tareas, mensajes, proyecto |
| `task` | Trabajo con fecha, estado y responsable | cualquier entidad asociable |
| `consentRecord` | Prueba de permiso o retirada por proposito/canal | contacto, campaña, mensaje |
| `conversation` | Hilo omnicanal asignable | contacto, oportunidad, mensajes |
| `automation` | Definicion versionada de un flujo | disparadores, nodos, ejecuciones |
| `segment` | Audiencia dinamica o estatica | contactos, campañas |
| `campaign` | Envio y medicion de una audiencia | segmento, mensajes, consentimientos |
| `quote` | Oferta comercial versionada | oportunidad, aceptacion, pagos, proyecto |
| `resource` | Persona, mesa, sala, equipo o capacidad reservable | servicios, reservas, horarios |
| `waitlistEntry` | Demanda pendiente con preferencias | contacto, servicio, recurso |
| `loyaltyAccount` | Puntos, saldo, nivel o bono | contacto, movimientos, recompensas |

Las entidades nuevas se incorporan como colecciones JSON y tablas PostgreSQL
equivalentes. Toda migracion sera aditiva e idempotente.

### 4.2 Compatibilidad durante la transicion

1. Los contactos actuales siguen siendo validos y visibles.
2. Un contacto comercial antiguo puede proyectarse como una oportunidad
   heredada sin alterar el JSON original.
3. Las escrituras nuevas crean `deal`; durante la transicion pueden reflejar el
   estado principal en `contact.status` para no romper informes antiguos.
4. Propuestas, reservas, facturas y proyectos admiten los nuevos IDs sin hacer
   obligatorios esos campos para registros historicos.
5. Ningun script borra registros. Las fusiones siguen siendo soft merge.
6. Cada migracion incorpora `--dry-run`, puede repetirse y registra sus cambios.

## 5. Nueva navegacion del dashboard

La interfaz se reorganizara progresivamente sin dejar rutas huerfanas:

| Grupo | Vistas |
| --- | --- |
| Hoy | Resumen, bandeja, tareas y alertas |
| Clientes y ventas | Contactos, cuentas, oportunidades, conversaciones y propuestas |
| Operaciones | Reservas, pedidos, equipo, inventario y recursos |
| Crecimiento | Google, reputacion, segmentos, campañas y fidelizacion |
| Dinero | Facturas, cobros, suscripciones, gastos y forecast |
| Analitica | Embudos, cohortes, atribucion, objetivos y calidad |
| Proyecto | Entregas, archivos, aprobaciones y portal |
| Ajustes | Usuarios, roles, integraciones, campos y automatizaciones |

Principios de interfaz:

- La portada responde primero a "que hago ahora".
- Las acciones frecuentes caben en uno o dos pasos.
- Cada cifra enlaza al conjunto de registros que la explica.
- Los estados vacios enseñan a configurar el siguiente paso.
- Toda automatizacion muestra causa, resultado, autor y posibilidad de detenerla.
- Movil permite triage y acciones rapidas; configuracion compleja se optimiza
  para escritorio sin bloquear el acceso.

## 6. Plan de ejecucion vinculante

Cada tarea solo se marca completada cuando incluye, segun corresponda:

- modelo JSON y PostgreSQL;
- validacion, aislamiento por negocio y API;
- interfaz responsive y accesible;
- compatibilidad o migracion idempotente;
- auditoria y permisos;
- pruebas unitarias, API y navegador;
- documentacion de endpoints y decisiones.

### Fase 0 - Cimientos relacionales y seguridad

#### 0.1 Contactos, pipelines y oportunidades separadas — COMPLETADA 2026-07-17

- [x] Crear colecciones `pipelines` y `deals` en JSON/PostgreSQL.
- [x] Crear pipeline comercial predeterminado con etapas estables y ordenadas.
- [x] Implementar CRUD, filtros, movimiento de etapa y auditoria de oportunidades.
- [x] Permitir varias oportunidades por contacto.
- [x] Mantener el Kanban antiguo mediante una proyeccion compatible.
- [x] Adaptar el dashboard para trabajar con oportunidades y abrir la persona
  asociada sin mezclar ambas identidades.
- [x] Añadir migracion idempotente de contactos abiertos con `--dry-run`.
- [x] Cubrir API, aislamiento, migracion, drag and drop y regresion del CRM.

Criterio de cierre: dos oportunidades del mismo contacto pueden estar en etapas
y pipelines distintos; mover una no modifica la otra ni pierde el timeline.

Entrega verificable:

- `GET|POST /api/businesses/:id/pipelines`
- `GET|PATCH|DELETE /api/businesses/:id/pipelines/:pipelineId`
- `GET|POST /api/businesses/:id/deals`
- `GET /api/businesses/:id/deals/pipeline`
- `GET|PATCH|DELETE /api/businesses/:id/deals/:dealId`
- `PATCH /api/businesses/:id/deals/:dealId/pipeline`
- `npm.cmd run crm:migrate-deals` simula; `-- --apply` aplica.
- `npm.cmd run test:crm-deals` cubre migracion, API y Chrome desktop/movil.

#### 0.2 Cuentas y asociaciones — COMPLETADA 2026-07-17

- [x] Crear `accounts` y `associations` con tipos validados.
- [x] Enlazar contactos, oportunidades, propuestas, reservas, mensajes,
  facturas y proyectos.
- [x] Añadir panel de relaciones en las fichas de cuenta y contexto de cuenta
  en oportunidades.
- [x] Detectar y fusionar cuentas duplicadas sin borrado destructivo.

Criterio de cierre: desde cualquier registro se puede explicar y navegar su
relacion con el cliente y el ingreso asociado.

Entrega verificable:

- `GET|POST /api/businesses/:id/accounts`
- `GET|PATCH|DELETE /api/businesses/:id/accounts/:accountId`
- `GET /api/businesses/:id/accounts/:accountId/relations`
- `GET /api/businesses/:id/accounts/duplicates`
- `POST /api/businesses/:id/accounts/merge`
- `GET|POST /api/businesses/:id/associations`
- `DELETE /api/businesses/:id/associations/:associationId`
- Asociaciones automaticas al crear o actualizar oportunidades, propuestas,
  reservas, proyectos, facturas y conversaciones.
- Migracion idempotente: `npm.cmd run crm:migrate-relations` simula y
  `npm.cmd run crm:migrate-relations -- --apply` aplica.
- `npm.cmd run test:crm-accounts` cubre modelo, migracion, API, aislamiento,
  merge y Chrome desktop/movil.
- Regresion superada: `check`, `test:backend-security`, `smoke:pilot`,
  `test:communications`, propuestas, operaciones y oportunidades.

#### 0.3 Responsables, tareas y colas — COMPLETADA 2026-07-17

- [x] Sustituir el limite de una proxima accion por tareas multiples asociables.
- [x] Añadir propietario, participantes, prioridad, fecha, recordatorio,
  recurrencia, resultado y dependencias ligeras.
- [x] Crear vistas Hoy, vencidas, sin asignar, mias y de equipo.
- [x] Convertir `nextAction` historicas sin duplicarlas en el timeline.

Criterio de cierre: cada oportunidad tiene responsable y ninguna tarea vencida
queda oculta por otra tarea activa.

Entrega verificable:

- `GET|POST /api/businesses/:id/tasks`
- `GET|PATCH|DELETE /api/businesses/:id/tasks/:taskId`
- `GET /api/businesses/:id/tasks/:taskId/relations`
- `GET /api/businesses/:id/tasks/queues`
- Migracion idempotente: `npm.cmd run crm:migrate-tasks` simula y
  `npm.cmd run crm:migrate-tasks -- --apply` aplica.
- Compatibilidad: los endpoints `contacts/:id/next-action` proyectan y
  completan la tarea equivalente sin duplicar el timeline.
- UI responsive con cinco colas, responsables, participantes, dependencias,
  recurrencia y oportunidades sin dueño.
- `npm.cmd run test:crm-tasks`, `check`, `test:backend-security`,
  `test:crm-deals`, `test:crm-accounts` y `smoke:pilot` superados.

#### 0.4 Consentimientos y preferencias — COMPLETADA 2026-07-17

- [x] Crear ledger inmutable de consentimiento por canal y proposito.
- [x] Registrar fuente, version del texto, fecha, actor, evidencia y retirada.
- [x] Añadir centro de preferencias y supresion global.
- [x] Bloquear audiencias y futuras campañas que no tengan base y canal permitidos.

Criterio de cierre: todo envio de campaña puede demostrar por que se incluyo al
destinatario y una retirada surte efecto antes del siguiente envio.

Entrega verificable:

- `GET|POST /api/businesses/:id/contacts/:contactId/consents`
- `GET|PUT /api/businesses/:id/contacts/:contactId/preferences`
- `POST /api/businesses/:id/consent/eligibility`
- Migracion idempotente: `npm.cmd run crm:migrate-consent` simula y
  `npm.cmd run crm:migrate-consent -- --apply` aplica.
- Los avisos de privacidad historicos se registran como `acknowledged` para
  servicio y nunca se convierten implicitamente en permiso de marketing.
- Centro responsive con permisos efectivos, retirada, supresion y ledger.
- `npm.cmd run test:crm-consent`, `check`, `test:backend-security` y
  `smoke:pilot` superados.

#### 0.5 Usuarios, roles y permisos efectivos — REQUISITO TRANSVERSAL PENDIENTE

- [ ] Crear usuarios de negocio independientes de los empleados operativos.
- [ ] Definir roles iniciales: propietario, responsable, comercial, operaciones,
  finanzas y solo lectura.
- [ ] Autorizar por recurso y accion en backend, no solo ocultar botones.
- [ ] Registrar cambios sensibles, exportaciones y suplantaciones.

Criterio de cierre: un usuario de operaciones no puede leer margenes ni cambiar
permisos aunque invoque directamente la API.

#### 0.6 Dinero normalizado

- [ ] Unificar clientes y asociaciones entre facturas generales y hospitality.
- [ ] Normalizar moneda, impuestos, estados, vencimientos y lineas.
- [ ] Enlazar pagos, suscripciones, propuestas y proyectos.
- [ ] Preservar registros que solo tengan `customerName`.

### Fase 1 - Accion comercial y automatizacion

#### 1.1 Bandeja omnicanal real

- [ ] Consolidar email y WhatsApp como primeros canales; preparar adaptadores
  para webchat, SMS e Instagram sin prometerlos en v1.
- [ ] Sincronizar entrada/salida, estados de entrega, adjuntos y errores.
- [ ] Resolver identidad, asignar conversaciones y medir primera respuesta.
- [ ] Incorporar notas internas, menciones, colision de agentes y cierre.
- [ ] Aplicar permisos, consentimiento, supresion y auditoria.

#### 1.2 Secuencias comerciales

- [ ] Crear pasos de email/tarea/WhatsApp con esperas y horarios permitidos.
- [ ] Inscribir de forma individual o masiva con previsualizacion.
- [ ] Detener al responder, reservar, aceptar o darse de baja.
- [ ] Medir entregas, respuestas, reuniones y conversion.

#### 1.3 Constructor de automatizaciones

- [ ] Disparadores de registro, evento, fecha, mensaje y webhook.
- [ ] Condiciones, ramas, esperas, acciones, objetivos y salida.
- [ ] Borrador/publicacion, versiones, prueba con registro, limites y apagado.
- [ ] Ejecuciones con log por nodo, idempotencia y reintentos controlados.
- [ ] Importar las reglas fijas actuales como recetas iniciales.

#### 1.4 Campos, vistas y pipelines configurables

- [ ] Campos personalizados tipados con validacion y permisos.
- [ ] Vistas guardadas, filtros compuestos, columnas y acciones masivas.
- [ ] Varios pipelines con reglas de entrada/salida y probabilidad por etapa.

### Fase 2 - Conversion, retencion y reputacion

#### 2.1 Cliente 360 y segmentacion — EN CURSO (PRIORIDAD ACTUAL)

- [ ] Perfil con timeline, oportunidades, conversaciones, reservas, pedidos,
  ingresos, incidencias, preferencias y consentimientos.
- [ ] Calcular LTV, frecuencia, ultima visita, ticket medio, RFM y riesgo.
- [ ] Segmentos dinamicos/estaticos con recuento y muestra antes de usar.

#### 2.2 Campañas y ciclo de vida

- [ ] Campañas segmentadas, programacion, zona horaria y quiet hours.
- [ ] Experimentacion limitada, exclusiones, frecuencia maxima y bajas.
- [ ] Resultados por ingreso y reserva, no solo aperturas o clics.

#### 2.3 Quote-to-cash

- [ ] Versionar propuestas y añadir enlace publico seguro y registro de vistas.
- [ ] Aceptacion verificable, firma opcional, deposito y calendario de pagos.
- [ ] Crear cliente/proyecto/factura/suscripcion de forma idempotente.
- [ ] Mostrar estado unico desde borrador hasta cobrado.

#### 2.4 Centro de reputacion

- [ ] Mostrar reseñas, sentimiento operativo, urgencia y SLA de respuesta.
- [ ] Responder desde DLS con borrador, aprobacion y registro.
- [ ] Solicitar reseña tras una experiencia elegible sin incentivos prohibidos.
- [ ] Medir solicitudes, reseñas obtenidas, nota y temas recurrentes.

#### 2.5 Fidelizacion y referidos

- [ ] Puntos/saldo/niveles o bonos configurables por negocio.
- [ ] Movimientos inmutables, caducidad, recompensas y correcciones auditadas.
- [ ] Referidos con codigo, atribucion, limites y prevencion de abuso.

### Fase 3 - Reservas y operacion vertical

#### 3.1 Motor de recursos y capacidad

- [ ] Recursos por tipo: profesional, mesa, sala, cabina, equipo o capacidad.
- [ ] Horarios, excepciones, duracion, buffers, aforo y reglas de asignacion.
- [ ] Disponibilidad que evite conflictos por recurso, no por negocio completo.

#### 3.2 Restauracion y experiencias

- [ ] Comensales, zonas, combinacion de mesas, turnos y duracion prevista.
- [ ] Lista de espera con preferencias, prioridad, oferta y caducidad.
- [ ] Experiencias/menus/eventos con inventario y reglas propias.

#### 3.3 Depositos, cancelacion y no-show

- [ ] Deposito o garantia configurable por servicio, fecha y segmento.
- [ ] Politica visible, consentimiento, devolucion y disputa auditada.
- [ ] Recordatorios confirmables y recuperacion de huecos liberados.
- [ ] Riesgo de no-show explicable, nunca bloqueo opaco automatico.

#### 3.4 Planificacion operativa

- [ ] Ocupacion, demanda prevista, rotacion, carga de personal y stock critico.
- [ ] Alertas accionables enlazadas al dato que las origina.

### Fase 4 - Analitica e IA segura

#### 4.1 Analitica de ciclo completo

- [ ] Embudos configurables y tiempos de conversion por etapa.
- [ ] Cohortes de primera visita, repeticion, retencion y churn.
- [ ] Ingresos por canal, campaña, servicio, oportunidad y cliente.
- [ ] Objetivos por negocio/equipo/persona con progreso y alertas.
- [ ] Diccionario de metricas y enlace desde cada KPI a sus registros.

#### 4.2 Prediccion explicable

- [ ] Calibrar probabilidad de cierre con historico y tamaño de muestra.
- [ ] Riesgo de abandono, no-show y stock con factores visibles.
- [ ] Comparar modelo con regla simple y permitir desactivarlo.

#### 4.3 Copiloto operativo

- [ ] Brief diario con prioridades, motivo y enlaces a evidencia.
- [ ] Resumen de conversaciones y timeline con citas al registro fuente.
- [ ] Borradores de respuesta y siguiente mejor accion revisables.
- [ ] Consultas en lenguaje natural sobre metricas autorizadas.
- [ ] Confirmacion explicita para enviar, borrar, cobrar, publicar o modificar
  permisos; registro completo de la accion humana y automatizada.

## 7. Orden de entrega y gates

No se empieza una fase dependiente hasta cerrar los criterios de la anterior,
salvo un quick win que solo reutilice capacidades existentes y no altere el
modelo. El Centro de reputacion es el principal candidato a ese tipo de entrega.

Para cada tarea:

1. Contrato y decisiones.
2. Store JSON y PostgreSQL.
3. Dominio y API.
4. Migracion/compatibilidad.
5. Interfaz y estados vacio/error/carga.
6. Seguridad, consentimiento y auditoria.
7. Pruebas unitarias, API y navegador.
8. Documentacion y actualizacion de este tracker.

Gates minimos globales:

```powershell
npm.cmd run check
npm.cmd run smoke:pilot
npm.cmd run test:backend-security
```

Cada modulo añade su suite especifica. Antes de una fase publica tambien se
ejecutan pruebas responsive, teclado, reduccion de movimiento, contraste,
restauracion de backup y migracion JSON/PostgreSQL.

## 8. Metricas de exito

| Objetivo | Metrica principal |
| --- | --- |
| No perder demanda | Porcentaje de leads con responsable y tarea dentro del SLA |
| Convertir mejor | Conversion por etapa, canal, campaña y segmento |
| Responder antes | Mediana y percentil 90 de primera respuesta |
| Vender y cobrar | Tiempo lead→aceptacion→cobro y tasa de cobro |
| Retener | Repeticion a 30/60/90 dias, LTV y reactivacion |
| Operar mejor | Ocupacion, no-show, espera, rotacion y utilizacion de recursos |
| Mejorar reputacion | Respuesta, nota, volumen y temas recurrentes |
| Automatizar con seguridad | Exito/error por flujo, tareas ahorradas y anulaciones |

No se usaran metricas vanidosas como prueba unica de exito. Aperturas, clics o
acciones generadas por IA deben conectarse con respuestas, reservas, ingresos o
tiempo operativo ahorrado.

## 9. Riesgos y limites

- **Complejidad prematura:** primero flujos opinados; la configuracion avanzada
  aparece cuando exista un caso real.
- **Dependencia de proveedores:** canales y pagos se implementan con adaptadores,
  webhooks idempotentes y estados degradados visibles.
- **Datos inconsistentes:** asociaciones y ledger antes que analitica avanzada.
- **Automatizacion peligrosa:** limites, modo prueba, version, apagado y log.
- **Privacidad:** minimizacion, exportacion/borrado controlado, retencion y
  permisos por campo cuando sea necesario.
- **IA inventando:** respuestas basadas en fuentes internas citables y ninguna
  accion sensible sin confirmacion.
- **Dashboard abrumador:** navegacion por trabajos y revelado progresivo.

## 10. Referencias de producto investigadas

La arquitectura recoge patrones maduros, no copias literales:

- HubSpot: workflows, objetos/asociaciones, sincronizacion de datos, Service
  Hub, Marketing Hub y quotes.
- Salesforce: Revenue Intelligence y recomendaciones comerciales.
- Pipedrive: sincronizacion de email, Smart Docs, actividades y señales de
  oportunidades estancadas.
- Zoho CRM: cadencias, personalizacion y orquestacion de journeys.
- Freshsales: secuencias, multiples pipelines, canales e informes.
- SevenRooms y Toast: perfiles de cliente, historial, etiquetas y marketing de
  hospitality.
- OpenTable y Zenchef: mesas, listas de espera, prepagos, depositos y no-show.
- Google Business Profile APIs: rendimiento, reseñas y respuestas.
- Comision Europea y autoridades de proteccion de datos: consentimiento
  demostrable, retirada sencilla y marketing directo.

Enlaces primarios para futuras decisiones tecnicas:

- https://knowledge.hubspot.com/workflows/create-workflows
- https://developers.hubspot.com/docs/guides/api/crm/objects/custom-objects
- https://www.salesforce.com/sales/revenue-intelligence/
- https://support.pipedrive.com/en/article/email-sync
- https://www.zoho.com/crm/cadences.html
- https://www.freshworks.com/crm/sales/sequences/
- https://sevenrooms.com/platform/guest-database/
- https://restaurant.opentable.com/products/features/deposits/
- https://www.zenchef.com/solutions/waitlist
- https://developers.google.com/my-business/content/review-data
- https://commission.europa.eu/law/law-topic/data-protection/data-protection-eu_en

## 11. Registro de avance

| Fecha | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 2026-07-17 | Investigacion y auditoria del dashboard | Completada | Inventario y decisiones de este documento |
| 2026-07-17 | Documento canonico y relevo de prioridad | Completada | `CRM_2_EJECUCION.md` y `AHORA.md` |
| 2026-07-17 | 0.1 Contactos, pipelines y oportunidades | Completada | `test:crm-deals`, `check`, `test:backend-security`, `smoke:pilot`, propuestas y timeline |
| 2026-07-17 | 0.2 Cuentas y asociaciones | Completada | `test:crm-accounts`, `test:communications`, `check`, `test:backend-security`, `smoke:pilot` |
| 2026-07-17 | 0.3 Responsables, tareas y colas | Completada | `test:crm-tasks`, `test:crm-deals`, `test:crm-accounts`, `check`, seguridad y smoke |
| 2026-07-17 | 0.4 Consentimientos y preferencias | Completada | `test:crm-consent`, `check`, seguridad y smoke con ledger de leads/reservas |
| 2026-07-17 | Reordenacion por analisis de huecos CRM | Completada | Cliente 360, bandeja real, automatizacion, campañas y quote-to-cash pasan delante; permisos queda como requisito transversal |
| 2026-07-17 | 0.5 Usuarios, roles y permisos efectivos | Pendiente transversal | Debe incorporarse a cada modulo sensible y cerrarse antes de automatizaciones autonomas |
| 2026-07-17 | 2.1 Cliente 360 y segmentacion | En curso | Agregacion de actividad, ingresos, RFM, riesgo, segmentos y siguiente mejor accion |
