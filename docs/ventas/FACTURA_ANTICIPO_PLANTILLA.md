# Plantilla de factura de anticipo

> BORRADOR PARA REVISION FISCAL. No emitir como factura real hasta que una
> gestoria confirme alta fiscal, serie, numeracion, impuestos, retenciones,
> software de facturacion y obligaciones de factura electronica aplicables.

## Factura

```text
FACTURA

Serie y numero: [SERIE]-[NUMERO CORRELATIVO]
Fecha de expedicion: [DD/MM/AAAA]
Fecha de recepcion del anticipo, si es distinta: [DD/MM/AAAA]

EMISOR
Nombre o razon social: [PRESTADOR]
NIF: [NIF]
Domicilio: [DOMICILIO]
Email: [EMAIL]

DESTINATARIO
Nombre o razon social: [CLIENTE]
NIF: [NIF CLIENTE]
Domicilio: [DOMICILIO CLIENTE]
Email: [EMAIL CLIENTE]

CONCEPTO
Anticipo del 50% para el servicio DLS Reservas de [NEGOCIO],
segun propuesta y condiciones version [VERSION] aceptadas el [FECHA].

Cantidad: 1
Precio unitario sin impuestos: [BASE] EUR
Base imponible: [BASE] EUR
Tipo impositivo: [TIPO] %
Cuota tributaria: [CUOTA] EUR
Retencion, si procede: [TIPO E IMPORTE]
TOTAL: [TOTAL] EUR

Medio de pago: [TRANSFERENCIA / ENLACE / OTRO]
Fecha de pago: [DD/MM/AAAA]
Referencia de pago: [REFERENCIA]
```

## Control antes de emitir

- [ ] La gestoria ha confirmado el tipo de IVA y cualquier retencion.
- [ ] La serie y el numero son correlativos.
- [ ] Emisor y destinatario incluyen nombre o razon social, NIF y domicilio.
- [ ] La descripcion identifica claramente el servicio y el anticipo.
- [ ] La base, tipo impositivo y cuota aparecen separados.
- [ ] La fecha del anticipo aparece si es distinta de la fecha de expedicion.
- [ ] Se conserva copia y referencia de la propuesta aceptada.
- [ ] La gestoria ha confirmado los requisitos de software, QR y factura
  electronica vigentes en la fecha de emision.
- [ ] Se ha definido como reflejar el anticipo en la factura final.

## Fuente para la gestoria

El articulo 6 del Reglamento de facturacion enumera el contenido de una factura
completa. El texto consolidado del BOE figura actualizado el 31 de marzo de
2026 e incluye cambios sobre sistemas de facturacion y factura electronica que
deben revisarse antes de emitir:

https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696
