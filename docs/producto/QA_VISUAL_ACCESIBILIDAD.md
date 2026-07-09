# QA visual y accesibilidad automatica

Este preflight abre la web en Chrome/Edge headless, genera capturas en desktop
y movil, navega con teclado y revisa problemas comunes antes de enviar una
demo o una entrega al cliente.

## Comando rapido

```powershell
npm.cmd run qa:visual
```

Por defecto arranca `server/server.mjs` en un puerto libre y audita:

```text
/index.html?presentation=true
```

La salida queda en:

```text
.tmp-qa-visual/
  desktop-1440x1000.png
  mobile-390x844.png
  qa-visual-report.html
  qa-visual-report.json
```

`.tmp-qa-visual` ya entra en el patron ignorado `.tmp-*`, asi que no ensucia
el repositorio.

## URL publica o ruta concreta

Auditar una demo ya levantada:

```powershell
npm.cmd run qa:visual -- --url=https://tu-demo.com
```

Auditar una pagina local distinta:

```powershell
npm.cmd run qa:visual -- --path=/pages/business-dashboard.html
```

Usar solo un viewport:

```powershell
npm.cmd run qa:visual -- --viewports=mobile
```

Hacer que cualquier aviso falle el comando:

```powershell
npm.cmd run qa:visual -- --fail-on-warnings
```

## Que comprueba

- Capturas full-page en desktop y movil.
- Arranque del Studio sin `data-studio-error`.
- Overflow horizontal del documento y posibles fuentes del desborde.
- Navegacion por teclado con `Tab`.
- Foco visible en elementos alcanzables por teclado.
- Nombres accesibles en enlaces, botones y controles.
- Formularios visibles con etiquetas y boton de envio.
- Tipos recomendados para correo y telefono.
- Imagenes visibles con atributo `alt`.
- Contraste basico WCAG AA cuando el fondo es un color solido.
- Elementos interactivos o texto posiblemente tapados por solapes.
- Tamanos tactiles pequenos en movil.

## Criterio de fallo

El comando devuelve codigo `1` si encuentra bloqueos. Los avisos quedan en el
reporte para revision manual, salvo que se use `--fail-on-warnings`.

Los chequeos visuales tienen una parte heuristica: detectan riesgos reales muy
rapido, pero el reporte final sigue siendo una ayuda de revision, no un
sustituto de mirar la captura antes de mandar la URL.
