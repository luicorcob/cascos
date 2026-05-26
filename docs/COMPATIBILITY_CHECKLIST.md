# Compatibility checklist

Objetivo: mantener LocalLift estable en moviles, tablets, desktop y navegadores modernos con degradacion razonable.

## Movil

- Inputs a 16px para evitar zoom automatico en iOS.
- Uso de `100dvh` con fallback `100vh`.
- Chatbot con `safe-area-inset-bottom` para iPhone.
- Botones tactiles minimo 44px en puntero tactil.
- Layout de editor, metricas, presets y formularios a una columna en pantallas pequenas.
- Chatbot a ancho completo en pantallas pequenas.
- Dock de conversion y formulario de lead adaptados a movil.
- Mapa embebido con alto minimo y layout a una columna.
- La vista `Movil` del editor fuerza reglas especificas aunque la ventana del navegador sea desktop.
- Probar `Demo en vivo`: variantes, comando rapido, toggles de secciones y deshacer/rehacer.
- Spotlight de cursor oculto en dispositivos tactiles.

## Navegadores

- Fallback para `:has()` con clase `.is-checked` gestionada por JS.
- Fallback para `color-mix()` en tarjetas, nav, chatbot, marquee y lineas.
- Fallback para `IntersectionObserver`: elementos reveal se muestran directamente.
- `-webkit-backdrop-filter` junto a `backdrop-filter`.
- CSS reduce motion con `prefers-reduced-motion`.

## Testing manual recomendado

1. Abrir `http://127.0.0.1:5173/index.html`.
2. Probar demos por sector.
3. Cambiar a vista movil.
4. Abrir chatbot y preguntar `horario`, `quiero reservar`, `resenas`.
5. Abrir la seccion de mapa y comprobar ruta/parking.
6. Enviar un lead de prueba y comprobar `window.localLiftLeads`.
7. Escribir al chatbot `Me llamo Ana, mi contacto es 600000000 y necesito cita manana`.
8. Exportar/importar datos JSON.
9. Probar tabs del editor en movil.
10. Exportar HTML y abrirlo por separado.
11. Revisar en Chrome, Edge, Safari iOS y Firefox.

## Comandos de verificacion

```powershell
npm.cmd run check
node server/server.mjs
```
