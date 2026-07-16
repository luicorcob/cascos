# Resultados de pruebas y ejecución controlada

Fecha de comprobación: 16 de julio de 2026. Entorno: Windows, Node.js `v24.13.1`, npm `11.8.0`, Chrome instalado localmente. La exigencia declarada por el proyecto es Node.js `>=22.19` (`package.json:7-9`).

## Resumen

| Comprobación | Resultado | Evidencia |
|---|---:|---|
| Sintaxis completa (`npm run check`) | PASA | Todos los `node --check` del script finalizaron sin error. |
| Smoke funcional (`npm run smoke:pilot`) | PASA | Health, autenticación admin, consentimiento de leads/reservas, CRM, agenda, eventos, reportes y preparación Google. |
| Suite Studio hasta guard de arquitectura | PARCIAL | Pasan core, estado, layouts, medios, imágenes, proveedor, publicación de demos, worker, datos, validación y renderer. |
| Guard de arquitectura | FALLA | `src/app.js` mide 253.766 bytes y el umbral es 180.000 (`server/scripts/test-studio-architecture.mjs:34`). |
| QA visual profunda | PASA | `npm run test:qa-visual`: “QA visual profundo: test superado”. |
| E2E de navegador Studio | FALLA | Chrome y un segundo intento seleccionando Edge terminan con `Runtime.evaluate: Target crashed` al esperar `data-studio-ready`. |
| Captura CDP controlada | PASA | 16 vistas cargadas y capturadas; `capturas/originales/capturas-ejecucion.json`. |
| Seguridad backend | PASA | `test:backend-security`, ejecutado durante la auditoría. |
| Integración Google simulada | PASA | `test:google`, sin usar credenciales reales. |
| CRM: timeline y propuestas | PASA | CRUD, separación por negocio, expiración, conversión, merge y exportación HTML/PDF. |
| CRM: plantillas, forecast, automatización, inbox, SLA, dashboard, atribución y calidad | PASA | Pruebas específicas del repositorio ejecutadas individualmente. |
| Imágenes de sitio y traspaso Radar → Studio | PASA | Pruebas específicas ejecutadas individualmente. |

## Smoke funcional

Comando: `npm.cmd run smoke:pilot`.

Salida final observada:

```text
Pilot smoke test passed.
Health: ok; contacts: 6; bookings: 1; events: 1.
Verified: admin auth, lead consent, booking consent, status changes,
monthly reports and Google readiness.
```

El script crea una copia temporal de `data/business-db.example.json`, levanta un servidor de prueba en un puerto libre y elimina el directorio temporal al finalizar (`server/scripts/smoke-test-pilot.mjs:17-45`). No opera sobre el almacén de producción.

## Fallo del guard de arquitectura

Comando: `npm.cmd run test:studio-architecture`.

Resultado reproducido:

```text
AssertionError: src/app.js must remain below 180 KB;
current size is 253766
```

No es un fallo funcional de una ruta concreta, sino una deuda de modularidad que detiene la suite compuesta `test:studio` antes de alcanzar su última comprobación. La QA visual se ejecutó por separado y pasó.

## Fallo E2E de navegador

Comando: `npm.cmd run test:studio-browser`, con persistencia JSON local y conexiones de base de datos remotas anuladas. Se repitió indicando como candidato Edge; el ejecutable no estaba disponible y el script usó el navegador instalado según su lógica de descubrimiento.

Resultado:

```text
Error: Runtime.evaluate: Target crashed
Expression: document.documentElement.dataset.studioReady === "true"
```

Clasificación: **incidencia reproducible de la prueba E2E en este entorno**. No invalida por sí sola el arranque del Studio: un recorrido CDP distinto cargó `data-studio-ready`, permitió cambiar el viewport y produjo las figuras 1 a 4. Sí impide afirmar que toda la secuencia interactiva larga de `test-studio-browser.mjs` haya sido superada.

## Alcance de “pasa”

Las pruebas de proveedores externos usan dobles, fixtures o configuración incompleta. Un test de Google, Stripe, imágenes o Cloudflare no acredita que exista una cuenta productiva, una autorización OAuth vigente o un despliegue externo operativo. Esas afirmaciones permanecen en **[NO VERIFICABLE]**.

## Cobertura estructural

`package.json` expone 34 scripts de comprobación, prueba u operación. En los scripts del servidor se localizaron aproximadamente 1.012 usos de `assert`. Este recuento describe volumen de aserciones, no porcentaje de cobertura; el repositorio no contiene un informe de cobertura de líneas o ramas.
