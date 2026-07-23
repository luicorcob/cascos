# Documentacion de DLS · Digital Local Sites

Empieza siempre por [`AHORA.md`](AHORA.md). Es el unico documento que responde
a estas preguntas:

- Cual es el objetivo activo.
- En que fase estamos.
- Que acciones van primero.
- Que esta bloqueado.
- Que no debemos hacer todavia.

## Jerarquia de autoridad

Cuando dos documentos parezcan contradecirse, manda el primero que aparezca en
esta lista:

1. [`AHORA.md`](AHORA.md): prioridades y siguiente accion.
2. [`activo/CRM_2_EJECUCION.md`](activo/CRM_2_EJECUCION.md): arquitectura,
   alcance, fases y registro del CRM 2.0 activo.
3. Los demas documentos de `activo/`: evidencia historica o instrucciones que
   solo se reactivan cuando `AHORA.md` las señale.
4. Documentos de `ventas/`, `producto/` y `operaciones/`: instrucciones para
   ejecutar tareas concretas.
5. Documentos de `referencia/`: contexto, investigacion y vision futura; nunca
   crean trabajo activo por si solos.

## Mapa rapido

### `activo/`

Solo contiene documentos que cambian durante la ejecucion del objetivo actual:

- Ejecucion del CRM 2.0 y suite operativa vertical.
- Plan vinculante para conseguir los primeros clientes.
- Tracker de la fase actual.
- Plan y base de datos de prospeccion.

### `ventas/`

Material que se usa para vender, cobrar y hacer onboarding:

- Oferta, one-pager y kit comercial.
- Ensayo de demo.
- Borradores de condiciones y factura.

### `producto/`

Calidad y decisiones funcionales del producto:

- Checklist de entrega y compatibilidad.

### `operaciones/`

Como publicar, validar y mantener DLS:

- Despliegue y lanzamiento del piloto.
- Publicador temporal de demos en Cloudflare.
- Runbook operativo.
- Servicio gestionado de Google.

### `referencia/`

Documentos utiles que no marcan prioridades actuales:

- Vision de producto y roadmaps anteriores.
- Roadmap de integracion Google y referencias de diseno.
- Material para inversores.
- Estructura tecnica, terceros y memoria TFG.

## Inventario

| Area | Documento | Funcion |
| --- | --- | --- |
| Mando | [`AHORA.md`](AHORA.md) | Objetivo, fase y siguientes acciones. |
| Activo | [`CRM_2_EJECUCION.md`](activo/CRM_2_EJECUCION.md) | Ejecucion canonica del CRM 2.0. |
| Activo | [`ARQUITECTURA_MODULAR_V3.md`](activo/ARQUITECTURA_MODULAR_V3.md) | Fronteras vigentes del Studio y router HTTP. |
| Activo | [`PLAN_DEFINITIVO_PRIMEROS_CLIENTES.md`](activo/PLAN_DEFINITIVO_PRIMEROS_CLIENTES.md) | Alcance y reglas vinculantes. |
| Activo | [`FASE_0_EJECUCION.md`](activo/FASE_0_EJECUCION.md) | Estado y evidencia de la fase actual. |
| Activo | [`CIERRE_FASE_0.md`](activo/CIERRE_FASE_0.md) | Gate binario y handoff de cierre. |
| Activo | [`PROSPECCION_SEVILLA.md`](activo/PROSPECCION_SEVILLA.md) | Metodo y marcador de prospeccion. |
| Activo | [`PROSPECTOS_FUNDADORES.csv`](activo/PROSPECTOS_FUNDADORES.csv) | Base comercial operativa. |
| Ventas | [`KIT_VENTA_Y_ONBOARDING.md`](ventas/KIT_VENTA_Y_ONBOARDING.md) | Reunion, objeciones y onboarding. |
| Ventas | [`ENSAYO_DEMO_COMERCIAL.md`](ventas/ENSAYO_DEMO_COMERCIAL.md) | Ensayo cronometrado y criterios. |
| Ventas | [`OFERTA_LOCAL_LIFT_RESERVAS.md`](ventas/OFERTA_LOCAL_LIFT_RESERVAS.md) | Oferta detallada. |
| Ventas | [`SALES_ONE_PAGER.md`](ventas/SALES_ONE_PAGER.md) | Resumen comercial corto. |
| Ventas | [`CONDICIONES_SERVICIO_FUNDADORES_BORRADOR.md`](ventas/CONDICIONES_SERVICIO_FUNDADORES_BORRADOR.md) | Borrador contractual. |
| Ventas | [`FACTURA_ANTICIPO_PLANTILLA.md`](ventas/FACTURA_ANTICIPO_PLANTILLA.md) | Plantilla de anticipo. |
| Ventas | [`INSTRUCCIONES_COBRO_DEPOSITO.md`](ventas/INSTRUCCIONES_COBRO_DEPOSITO.md) | Procedimiento inicial de cobro. |
| Ventas | [`PAQUETE_REVISION_PROFESIONAL.md`](ventas/PAQUETE_REVISION_PROFESIONAL.md) | Handoff para asesoria y gestoria. |
| Producto | [`DELIVERY_CHECKLIST.md`](producto/DELIVERY_CHECKLIST.md) | Evidencia de calidad de entrega. |
| Producto | [`COMPATIBILITY_CHECKLIST.md`](producto/COMPATIBILITY_CHECKLIST.md) | QA responsive y navegadores. |
| Operaciones | [`PILOT_LAUNCH.md`](operaciones/PILOT_LAUNCH.md) | Publicacion y aceptacion del piloto. |
| Operaciones | [`DEPLOYMENT.md`](operaciones/DEPLOYMENT.md) | Guia de despliegue. |
| Operaciones | [`SUPABASE_RLS_FASE_2.md`](operaciones/SUPABASE_RLS_FASE_2.md) | Politicas RLS para migracion a Supabase. |
| Operaciones | [`BACKEND_SECURITY_FASE_3.md`](operaciones/BACKEND_SECURITY_FASE_3.md) | Validacion, auth y rate limiting del backend. |
| Operaciones | [`HTTP_SECURITY_FASE_4.md`](operaciones/HTTP_SECURITY_FASE_4.md) | CORS estricto y cabeceras HTTP de seguridad. |
| Operaciones | [`DEPENDENCIAS_FASE_6.md`](operaciones/DEPENDENCIAS_FASE_6.md) | Auditoria npm en CI, Dependabot y politica de dependencias. |
| Operaciones | [`LOGGING_MONITORIZACION_FASE_7.md`](operaciones/LOGGING_MONITORIZACION_FASE_7.md) | Logging estructurado, alertas de auth y politica de backups. |
| Operaciones | [`CHECKLIST_FINAL_FASE_8.md`](operaciones/CHECKLIST_FINAL_FASE_8.md) | Escaneo final de secretos, checklist local y gates externos de produccion. |
| Operaciones | [`DEMO_PUBLISH_CLOUDFLARE.md`](operaciones/DEMO_PUBLISH_CLOUDFLARE.md) | Demos publicas temporales con Workers + KV. |
| Operaciones | [`OPERATIONS_RUNBOOK.md`](operaciones/OPERATIONS_RUNBOOK.md) | Salud, incidentes y restauracion. |
| Operaciones | [`GOOGLE_CLIENT_SERVICE_PLAYBOOK.md`](operaciones/GOOGLE_CLIENT_SERVICE_PLAYBOOK.md) | Operacion del servicio Google. |
| Operaciones | [`GOOGLE_CLOUD_SETUP.md`](operaciones/GOOGLE_CLOUD_SETUP.md) | Alta tecnica, credenciales y consentimiento Google. |
| Referencia | [`PRODUCT_ACTION_PLAN.md`](referencia/PRODUCT_ACTION_PLAN.md) | Investigacion y plan anterior. |
| Referencia | [`PLAN_MAESTRO_DIGITALIZACION_TOTAL.md`](referencia/PLAN_MAESTRO_DIGITALIZACION_TOTAL.md) | Vision de largo plazo. |
| Referencia | [`GOOGLE_INTEGRATION_PLAN.md`](referencia/GOOGLE_INTEGRATION_PLAN.md) | Roadmap tecnico no activo. |
| Referencia | [`PRODUCT_DESIGN_REFERENCES.md`](referencia/PRODUCT_DESIGN_REFERENCES.md) | Criterios visuales. |
| Referencia | [`INVESTOR_MEMO.md`](referencia/INVESTOR_MEMO.md) | Memo para inversores. |
| Referencia | [`INVESTOR_DEMO_SCRIPT.md`](referencia/INVESTOR_DEMO_SCRIPT.md) | Guion para inversores. |
| Referencia | [`PROJECT_STRUCTURE.md`](referencia/PROJECT_STRUCTURE.md) | Estructura tecnica. |
| Referencia | [`THIRD_PARTY.md`](referencia/THIRD_PARTY.md) | Recursos de terceros. |
| Referencia | [`LOCAL_LIFT_STUDIO_MEMORIA_TFG.md`](referencia/LOCAL_LIFT_STUDIO_MEMORIA_TFG.md) | Memoria academica. |

## Reglas para evitar otro caos

1. Todo objetivo nuevo se registra primero en `AHORA.md`.
2. Solo puede existir un plan operativo activo.
3. Una checklist demuestra calidad; no crea prioridades.
4. Un roadmap de referencia no se convierte en tarea hasta aparecer en el plan
   activo.
5. Los documentos nuevos deben vivir en una de las cinco carpetas.
6. No crear otro archivo llamado `PLAN_*` dentro de `activo/` sin retirar o
   sustituir expresamente el anterior.
7. Al cerrar una fase, actualizar primero `AHORA.md` y despues su tracker.
