# Gate de cierre de Fase 0

Estado actual: **preparacion local completa; cierre externo pendiente**.

Fase 0 solo se marca cerrada cuando pasan el comando local y las diez
evidencias externas. No se aceptan estimaciones ni documentos sin revisar como
sustituto de una prueba real.

Ultima auditoria local: 12 de junio de 2026.

- `phase0:verify-local`: aprobado.
- `accept:public` contra servidor temporal aislado: aprobado con privacidad,
  CORS exacto, lead, reserva confirmada, eventos y reportes.
- `phase0:check`: bloqueado unicamente por diez evidencias externas.

## Verificacion local

```powershell
npm.cmd run phase0:verify-local
```

Debe terminar con `Preparacion local de Fase 0 aprobada`.

## Despliegue y aceptacion publica

1. Crear el servicio usando `render.yaml` o un proveedor equivalente con disco
   persistente.
2. Configurar `CORS_ORIGIN` con la URL HTTPS real.
3. Crear o cargar el negocio piloto y confirmar su `id` y `slug`.
4. Ejecutar:

```powershell
$env:PILOT_API_BASE_URL="https://api.example.com"
$env:PILOT_DEMO_URL="https://demo.example.com/index.html?presentation=true&view=mobile"
$env:PILOT_ADMIN_TOKEN="<token-real-de-32-caracteres-o-mas>"
$env:PILOT_BUSINESS_ID="<id>"
$env:PILOT_BUSINESS_SLUG="<slug>"
$env:PILOT_PRIVACY_URL="https://demo.example.com/privacidad"
$env:PILOT_FRONTEND_ORIGIN="https://demo.example.com"
npm.cmd run accept:public
```

Guardar la salida del comando como evidencia. Despues comprobar manualmente la
demo desde ventana privada y Safari iOS.

## Cobro, legal y ensayo

- Cobro: completar `docs/ventas/INSTRUCCIONES_COBRO_DEPOSITO.md`.
- Revision: enviar `docs/ventas/PAQUETE_REVISION_PROFESIONAL.md`.
- Ensayo: completar un intento aprobado en
  `docs/ventas/ENSAYO_DEMO_COMERCIAL.md`.

## Gate final

Cuando existan las evidencias, establecer las variables solo durante la
comprobacion final:

```powershell
$env:PHASE0_PUBLIC_DEMO_URL="https://demo.example.com"
$env:PHASE0_PUBLIC_API_URL="https://api.example.com"
$env:LOCALLIFT_ADMIN_TOKEN="<token-real-de-32-caracteres-o-mas>"
$env:CORS_ORIGIN="https://demo.example.com"
$env:PHASE0_PUBLIC_ACCEPTANCE_PASSED="true"
$env:PHASE0_PAYMENT_READY="true"
$env:PHASE0_LEGAL_REVIEWED="true"
$env:PHASE0_FISCAL_REVIEWED="true"
$env:PHASE0_SAFARI_IOS_PASSED="true"
$env:PHASE0_DEMO_REHEARSED="true"
npm.cmd run phase0:check
```

## Registro de evidencias

| Evidencia | Fecha | Responsable | Enlace o nota |
| --- | --- | --- | --- |
| URL publica de demo |  |  |  |
| URL publica de API |  |  |  |
| Token admin real configurado |  |  |  |
| CORS real configurado |  |  |  |
| Aceptacion publica automatizada |  |  |  |
| Aceptacion manual privada |  |  |  |
| Safari iOS |  |  |  |
| Revision legal |  |  |  |
| Revision fiscal |  |  |  |
| Medio de cobro probado |  |  |  |
| Ensayo comercial aprobado |  |  |  |
| Gate final `phase0:check` |  |  |  |
