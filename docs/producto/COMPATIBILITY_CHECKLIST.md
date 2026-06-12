# Compatibility checklist

Objetivo: mantener LocalLift estable en moviles, tablets, desktop y navegadores
modernos con degradacion razonable.

Ultima ejecucion local: 12 de junio de 2026.

## Resultado ejecutado

| Entorno | Estado | Evidencia |
| --- | --- | --- |
| Chrome 148, desktop | Aprobado | Studio y presentacion directa cargan sin error visual bloqueante. |
| Chrome 148, movil emulado 390 x 844 | Aprobado | `innerWidth`, documento y cuerpo miden 390 px; CTA, titular y texto visibles; sin desbordamiento horizontal del documento. |
| Edge 149, movil | Aprobado | La URL directa abre Luma Studio en presentacion y vista movil. |
| Firefox 149, movil 390 x 844 | Aprobado visual | Presentacion directa, navegacion, CTA, titular y descripcion visibles en captura aislada. |
| Safari iOS | Pendiente externo | Requiere un iPhone o servicio de dispositivos reales. |

URL local usada:

```text
http://127.0.0.1:8081/index.html?presentation=true&view=mobile
```

La URL admite `view=desktop`, `view=tablet` y `view=mobile`. Con
`presentation=true` abre directamente la demo sin enseñar el editor.

## Protecciones presentes

- [x] Inputs a 16px para evitar zoom automatico en iOS.
- [x] Uso de `100dvh` con fallback `100vh`.
- [x] Chatbot con `safe-area-inset-bottom` para iPhone.
- [x] Botones tactiles de al menos 44px en puntero tactil.
- [x] Layout de editor, metricas, presets y formularios a una columna.
- [x] Chatbot, dock de conversion, formulario de lead y mapa adaptados a movil.
- [x] La vista `Movil` fuerza reglas especificas aunque el navegador sea desktop.
- [x] Spotlight y efectos de inclinacion desactivados en dispositivos tactiles.
- [x] Navegacion y hero contenidos dentro del ancho movil.
- [x] Fallback para `:has()` con clase `.is-checked`.
- [x] Fallback para `color-mix()` e `IntersectionObserver`.
- [x] `-webkit-backdrop-filter` junto a `backdrop-filter`.
- [x] Reduccion de movimiento con `prefers-reduced-motion`.

## Pendiente antes de aceptar la URL publica

1. Probar Safari en un iPhone real.
2. Abrir la URL publica desde movil y ventana privada.
3. Comprobar llamada, WhatsApp, mapa, lead, reserva y privacidad.
4. Repetir `npm.cmd run smoke:pilot` contra la configuracion de despliegue.

## Comandos de verificacion

```powershell
npm.cmd run check
npm.cmd run smoke:pilot
node server/server.mjs
```
