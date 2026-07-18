# CRM 2.0 - entrega final verificable

Fecha de cierre: **18 de julio de 2026**

Estado: **completado**

Este documento resume el contrato tecnico de la entrega final. El desglose
funcional y todos los criterios de aceptacion permanecen en
[`CRM_2_EJECUCION.md`](CRM_2_EJECUCION.md).

## Superficies entregadas

| Dominio | API principal | Persistencia y controles |
| --- | --- | --- |
| Usuarios y RBAC | `/api/business-users/*`, `/api/businesses/:id/security/*` | usuarios independientes, sesiones firmadas, seis roles, auditoria y suplantacion |
| Dinero | `/api/businesses/:id/money/*` | registros normalizados, impuestos, lineas, vencimientos, pagos idempotentes y asociaciones |
| Configuracion CRM | `/api/businesses/:id/crm-config/*` | campos tipados, vistas compuestas y reglas de pipeline |
| Reputacion | `/api/businesses/:id/reputation/*` | reseñas sincronizadas, respuestas aprobadas, solicitudes y tracking |
| Fidelizacion | `/api/businesses/:id/loyalty/*` | ledger inmutable, niveles/bonos, recompensas y referidos antiabuso |
| Operacion vertical | `/api/businesses/:id/vertical/*` | zonas, mesas, turnos, experiencias, politicas, recordatorios y planificacion |
| Analitica e IA | `/api/businesses/:id/intelligence/*` | embudos, cohortes, objetivos, predicciones explicables y borradores confirmables |

Las nuevas colecciones tienen equivalencia JSON/PostgreSQL en el store. Todas
las rutas privadas se resuelven dentro del negocio autenticado y pasan por la
matriz backend de recurso y accion. Los portales de cliente conservan lectura
limitada y no pueden mutar recursos de administracion.

## Decisiones de seguridad

- Las autorizaciones se evaluan en el servidor; la visibilidad de un boton no
  concede permisos.
- Las operaciones sensibles registran actor, negocio, recurso, accion y
  contexto. Suplantaciones y exportaciones tambien quedan auditadas.
- Cobrar, publicar una respuesta, cambiar permisos o confirmar una accion del
  copiloto requiere una confirmacion humana explicita.
- El copiloto crea borradores y eventos de confirmacion idempotentes; no afirma
  que una accion externa se haya ejecutado si no existe evidencia del proveedor.
- Consentimiento, supresion, anti-incentivos y limites antiabuso se comprueban
  antes de envios de reputacion, fidelizacion o marketing.
- Pagos y webhooks se concilian con claves idempotentes.

## Compatibilidad y migraciones

- Los contactos y pipelines historicos siguen disponibles mediante sus
  proyecciones de compatibilidad.
- Las facturas con solo `customerName` se preservan y pueden reconciliarse sin
  forzar una asociacion inexistente.
- Ninguna migracion borra registros. Las relaciones y el dinero se normalizan
  de forma aditiva y repetible.
- Dinero: `npm.cmd run crm:migrate-money` simula y
  `npm.cmd run crm:migrate-money -- --apply` persiste.
- Las migraciones anteriores de oportunidades, relaciones, tareas y
  consentimiento mantienen sus modos de simulacion y aplicacion.

## Evidencia de pruebas

Gates globales superados el 18 de julio de 2026:

```powershell
npm.cmd run check
npm.cmd run smoke:pilot
npm.cmd run test:backend-security
npm.cmd run security:phase8
```

Suites de la entrega final:

```powershell
npm.cmd run test:crm-foundation
npm.cmd run test:crm-reputation
npm.cmd run test:crm-growth-operations
npm.cmd run test:crm-intelligence
```

Regresiones superadas:

- oportunidades, cuentas, tareas, consentimiento y timeline;
- Cliente 360, omnicanal, automatizaciones, campañas y plantillas;
- quote-to-cash, propuestas, recursos y reservas;
- operaciones, comunicaciones y hospitality;
- forecast, SLA, inbox, dashboard, atribucion y calidad de datos;
- autenticacion, cifrado, renovacion, snapshot y desconexion de Google.

Las suites nuevas incluyen pruebas de dominio/modelo, API multiempresa y
navegador responsive. Las regresiones antiguas confirman que el cierre no rompe
los flujos existentes.

## Limite operativo explicito

Los adaptadores de Google, email, WhatsApp y Stripe admiten modo de desarrollo.
En produccion necesitan credenciales y webhooks validos del proveedor. La
ausencia de esas credenciales no degrada la seguridad: la interfaz mantiene el
estado pendiente/error y no registra publicaciones, envios o cobros ficticios.

En este workspace, `npm.cmd run google:check` informa que faltan
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_TOKEN_ENCRYPTION_KEY` y
`GOOGLE_MAPS_API_KEY`. `npm.cmd run test:google` si pasa; la publicacion real en
Google permanecera desactivada hasta que el entorno de produccion reciba esos
valores.
