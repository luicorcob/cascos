# Fase 0 - Preparar la venta

Ventana: 11 al 14 de junio de 2026.

Funcion: tracker de ejecucion y evidencia de la fase actual. No amplia el
alcance definido en `docs/activo/PLAN_DEFINITIVO_PRIMEROS_CLIENTES.md`.

Objetivo: terminar el 14 de junio con una demo publicable, un flujo verificable y todo lo necesario para cobrar un deposito.

Estado binario: **preparacion local completa; cierre externo pendiente**.

## Estado actual

### Producto y operacion

- [x] Formularios publicos con consentimiento obligatorio.
- [x] URL de privacidad configurable por negocio.
- [x] Evidencia de consentimiento guardada en contactos y reservas.
- [x] Rate limiting separado para leads, reservas y eventos.
- [x] Blueprint de Render con servicio de pago y disco persistente.
- [x] Studio abre directamente con la demo de belleza Luma Studio.
- [x] URL directa de presentacion movil preparada para reuniones.
- [x] Pagina de privacidad de demostracion creada y enlazada.
- [x] Configuracion sectorial de la demo Luma Studio elegida.
- [x] Comprobacion sintactica completa.
- [x] Smoke test de rate limiting: `201, 201, 429`.
- [x] Smoke test de persistencia del consentimiento.
- [x] Prueba integral local automatizada del flujo principal.
- [x] Restauracion local verificada con copia `pre-restore`.
- [x] Responsable y rutina diaria de `/api/health` definidos.
- [x] QA local aprobado en Chrome 148, Edge 149 y Firefox 149.
- [x] Aceptacion publica automatizada preparada.
- [x] Gate binario de cierre de Fase 0 preparado.
- [ ] Completar QA en Safari iOS.
- [ ] Revisar legalmente y sustituir el texto de privacidad de demostracion.
- [ ] Publicar backend y demo.
- [ ] Configurar token admin y CORS reales.
- [ ] Ejecutar prueba completa desde la URL publica.

### Venta

- [x] Oferta, nicho, precio y condiciones cerrados.
- [x] Documento de propuesta preparado.
- [x] Plantilla de lista comercial preparada.
- [x] Guion de demo, cierre y onboarding preparado.
- [x] Ciudad inicial confirmada: Sevilla capital.
- [x] Reparto de los primeros 100 prospectos por zonas preparado.
- [x] Borradores de factura de anticipo y condiciones contractuales preparados.
- [x] Primeros 20 prospectos cualificados y verificados con datos publicos.
- [x] Base inicial de 100 prospectos preparada; los 80 restantes se cualifican
  en Fase 1 despues de contactar la primera tanda.
- [x] Hoja de ensayo comercial cronometrado preparada.
- [x] Procedimiento de cobro del deposito preparado.
- [x] Paquete para revision legal y fiscal preparado.
- [ ] Preparar medio para cobrar el deposito.
- [ ] Revisar factura y condiciones con gestoria y asesoria legal.
- [ ] Ensayar la demo comercial de diez minutos.

## Configuracion obligatoria del piloto

```text
NODE_ENV=production
HOST=0.0.0.0
LOCALLIFT_ADMIN_TOKEN=<token-de-32-caracteres-o-mas>
CORS_ORIGIN=<dominio-real-de-la-demo>
BUSINESS_DB_FILE=/data/business-db.json
BUSINESS_DB_BACKUP_DIR=/data/backups
BUSINESS_DB_BACKUPS=true
PUBLIC_LEAD_RATE_LIMIT=6
PUBLIC_LEAD_RATE_LIMIT_WINDOW_MS=600000
PUBLIC_BOOKING_RATE_LIMIT=6
PUBLIC_BOOKING_RATE_LIMIT_WINDOW_MS=600000
PUBLIC_EVENT_RATE_LIMIT=120
PUBLIC_EVENT_RATE_LIMIT_WINDOW_MS=600000
```

## Prueba de aceptacion publica

Debe realizarse desde movil y desde una ventana privada:

1. Abrir la demo de Luma Studio.
2. Comprobar que llamada, WhatsApp, mapa y reserva funcionan.
3. Enviar un lead aceptando privacidad.
4. Confirmar que el lead aparece en el portal.
5. Confirmar que el contacto guarda `privacyAccepted: true`.
6. Enviar una solicitud de cita.
7. Confirmar que aparece en agenda y puede cambiar de estado.
8. Confirmar que el reporte recoge los eventos.
9. Confirmar que `/api/businesses` sin token responde `401`.
10. Confirmar que `/api/health` responde `ok: true`.
11. Descargar una copia y documentar como restaurarla.

## Evidencia local completada

- `npm.cmd run check`: comprobacion sintactica completa correcta.
- `npm.cmd run smoke:pilot`: salud, token admin, lead, consentimiento, reserva,
  cambios de estado, evento y reporte verificados con base temporal.
- `npm.cmd run restore:businesses -- <copia> <base-temporal> --confirm`:
  restauracion correcta y copia `pre-restore` creada.
- `docs/operaciones/OPERATIONS_RUNBOOK.md`: Luis revisa `/api/health` antes de las 10:00
  (`Europe/Madrid`) y dispone de procedimiento de incidente y restauracion.
- `docs/producto/COMPATIBILITY_CHECKLIST.md`: Chrome, Edge y Firefox verificados
  localmente; queda Safari iOS.
- `docs/activo/PROSPECTOS_FUNDADORES.csv`: 20 negocios cualificados con telefono,
  valoracion y problema observable, sin inventar responsables ni correos.
- `docs/ventas/ENSAYO_DEMO_COMERCIAL.md`: recorrido de diez minutos y criterios de
  aprobado preparados; ensayo humano pendiente.
- `npm.cmd run phase0:verify-local`: gate de preparacion local.
- `npm.cmd run accept:public`: aceptacion automatizada probada contra un
  servidor temporal aislado, incluyendo privacidad, CORS, lead, reserva,
  cambios de estado, eventos y reportes; queda repetirla contra la URL
  desplegada.
- `docs/activo/CIERRE_FASE_0.md`: instrucciones y registro del cierre externo.

## Donde consultar la prioridad

La lista ordenada de siguientes acciones y bloqueos se mantiene exclusivamente
en `docs/AHORA.md`. Este documento solo registra estado y evidencia de Fase 0.

## Bloqueos que impiden prospectar el 15 de junio

Solo estos bloqueos justifican retrasar el inicio comercial:

- No existe una URL publica que mostrar.
- No se puede cobrar un deposito.
- Leads o reservas reales no llegan al portal.
- Los datos desaparecen al reiniciar el backend.
- No existe un texto de privacidad revisado para la demo.

Las mejoras visuales menores, nuevas funciones y automatizaciones no justifican retrasar ventas.
