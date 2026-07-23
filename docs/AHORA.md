# Ahora

Ultima actualizacion: 23 de julio de 2026.

Este es el panel de mando canonico de DLS. La arquitectura vigente del Studio
y del servidor esta documentada en
[`activo/ARQUITECTURA_MODULAR_V3.md`](activo/ARQUITECTURA_MODULAR_V3.md).

## Objetivo completado

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

## Estado actual

**CRM 2.0 y suite operativa vertical completados y verificados.**

La interfaz queda separada en dos superficies con responsabilidades distintas:

- `pages/admin-dashboard.html` es Control DLS: CRM multi-cliente, ofertas,
  producción, servicios, facturación, cobros, accesos y soporte del propio DLS.
- `pages/client-dashboard.html` es el portal privado de cada local: clientes del
  negocio, reservas, empleados, turnos, inventario, cuentas e informes.

Las rutas históricas redirigen a estas entradas para conservar enlaces y
automatizaciones existentes. El portal de cliente exige sesión salvo cuando se
abre de forma explícita como vista previa desde Control DLS.

El plan `CRM_2_EJECUCION.md` queda sin tareas pendientes. Incluye cimientos
relacionales, seis roles con autorizacion backend, dinero normalizado,
omnicanal, automatizaciones, campañas, quote-to-cash, Cliente 360, reputacion,
fidelizacion, reservas y operacion vertical, analitica completa, prediccion
explicable y copiloto con fuentes y confirmacion humana.

El contrato tecnico, los endpoints, las decisiones de seguridad y la evidencia
de regresion estan resumidos en
[`activo/CRM_2_ENTREGA_FINAL.md`](activo/CRM_2_ENTREGA_FINAL.md).

## Siguientes acciones operativas

1. Configurar credenciales reales de Google, email, WhatsApp y Stripe en el
   entorno de despliegue que corresponda.
2. Ejecutar migraciones en modo simulacion, revisar el resumen y aplicar sobre
   una copia de seguridad verificada.
3. Crear el primer usuario propietario de cada negocio y revisar su matriz de
   roles.
4. Hacer una aceptacion de usuario con datos reales antes de activar envios,
   publicaciones o cobros de produccion.

## Verificacion obligatoria

En cada entrega CRM:

```powershell
npm.cmd run check
npm.cmd run smoke:pilot
npm.cmd run test:backend-security
```

Tambien se ejecuta la suite especifica del modulo modificado. Los cambios de
Google conservan `npm.cmd run test:google`; los del Studio conservan
`npm.cmd run test:studio`. Los cambios en composicion o rutas conservan
`npm.cmd run test:architecture`.

## Reglas de ejecucion

- No duplicar contactos, actividades, propuestas, mensajes, reservas o
  documentos que ya existen.
- JSON y PostgreSQL reciben el mismo modelo.
- Migraciones aditivas, idempotentes y con simulacion previa.
- Backend autoriza; ocultar un boton no cuenta como permiso.
- Ninguna accion sensible de IA, campaña o automatizacion ocurre sin log y los
  controles definidos en el plan.
- Una tarea solo se cierra con modelo, API, UI, compatibilidad y pruebas.

## Fuera del contrato cerrado

- Canales adicionales a email y WhatsApp.
- Marketplace publico de integraciones.
- Personalizacion ilimitada fuera de los flujos verticales entregados.
- Acciones autonomas sensibles sin confirmacion humana.
