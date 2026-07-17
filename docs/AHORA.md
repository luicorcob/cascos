# Ahora

Ultima actualizacion: 17 de julio de 2026.

Este es el panel de mando canonico de DLS. El objetivo anterior de arquitectura
frontend del Studio esta completado y documentado en
[`activo/ARQUITECTURA_FRONTEND_V2.md`](activo/ARQUITECTURA_FRONTEND_V2.md).

## Objetivo activo

Convertir el dashboard actual en un **CRM 2.0 y suite operativa vertical** para
negocios locales, preservando lo ya construido y cerrando el ciclo completo:
captacion, oportunidad, conversacion, seguimiento, propuesta, cobro, operacion,
retencion, reputacion y analitica.

Plan vinculante:
[`activo/CRM_2_EJECUCION.md`](activo/CRM_2_EJECUCION.md).

Resultados que definen el exito:

- Contactos y oportunidades son entidades distintas y asociables.
- Cada trabajo tiene responsable, fecha, permisos y trazabilidad.
- Email y WhatsApp funcionan como conversaciones reales dentro de DLS.
- Automatizaciones, secuencias y campañas son configurables y auditables.
- Propuestas pueden terminar en aceptacion, cobro, proyecto y factura.
- La ficha Cliente 360 une relacion, reservas, ingresos y preferencias.
- Reservas modelan recursos, capacidad, espera, depositos y no-show.
- Reputacion, cohortes, objetivos e IA producen acciones explicables.

## Fase actual

**Prioridad de producto — Cliente 360 y segmentacion accionable.**

Los cimientos 0.1 a 0.4 estan completados y verificados. El analisis de huecos
aportado el 17 de julio reordena la ejecucion: la tarea activa es **2.1,
Cliente 360**, porque es el mayor hueco visible y vendible que puede construirse
ya sobre contactos, relaciones, tareas y consentimientos. Roles y permisos 0.5
se mantienen como requisito transversal de los modulos sensibles.

## Siguientes acciones, en orden

1. Unificar en una ficha Cliente 360 contactos, actividad, reservas,
   oportunidades, conversaciones, propuestas, proyectos, facturas y pagos.
2. Calcular gasto, ticket medio, frecuencia, ultima y proxima visita, LTV,
   RFM, no-show y riesgo con explicaciones visibles.
3. Crear segmentos dinamicos con recuento y muestra: VIP, recurrentes,
   nuevos, en riesgo, inactivos y con saldo pendiente.
4. Proponer una siguiente mejor accion explicable y compatible con los
   consentimientos efectivos del contacto.
5. Publicar el workspace responsive en la pestaña Clientes.
6. Verificar modelo, API multiempresa, navegador y regresiones obligatorias.

## Verificacion obligatoria

En cada entrega CRM:

```powershell
npm.cmd run check
npm.cmd run smoke:pilot
npm.cmd run test:backend-security
```

Tambien se ejecuta la suite especifica del modulo modificado. Los cambios de
Google conservan `npm.cmd run test:google`; los del Studio conservan
`npm.cmd run test:studio`.

## Reglas de ejecucion

- No duplicar contactos, actividades, propuestas, mensajes, reservas o
  documentos que ya existen.
- JSON y PostgreSQL reciben el mismo modelo.
- Migraciones aditivas, idempotentes y con simulacion previa.
- Backend autoriza; ocultar un boton no cuenta como permiso.
- Ninguna accion sensible de IA, campaña o automatizacion ocurre sin log y los
  controles definidos en el plan.
- Una tarea solo se cierra con modelo, API, UI, compatibilidad y pruebas.

## Pospuesto hasta que lo desbloquee su fase

- IA autonoma o prediccion antes de normalizar datos y permisos.
- Canales adicionales antes de estabilizar email y WhatsApp.
- Marketplace de integraciones antes de tener adaptadores internos solidos.
- Personalizacion ilimitada que complique los flujos verticales principales.
