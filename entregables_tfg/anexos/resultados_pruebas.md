# Resultados de pruebas y ejecución controlada

Fecha de comprobación final: 23 de julio de 2026. Entorno: Windows, Node.js `v24.13.1`, npm `11.8.0`. El runtime declarado es Node.js `>=22.19`.

## Resumen

| Comprobación | Resultado | Evidencia |
|---|---:|---|
| Sintaxis dinámica (`npm run check`) | PASA | 260 módulos `.js`/`.mjs` descubiertos y comprobados. |
| Arquitectura (`npm run test:architecture`) | PASA | Studio: 163.228 bytes. Servidor: 6.472 bytes y 39 familias API. |
| Suite Studio (`npm run test:studio`) | PASA | Core, módulos extraídos, estado, layouts, medios, imágenes, publicación, datos, renderer, guard y QA. |
| Smoke (`npm run smoke:pilot`) | PASA | Health, auth admin, consentimiento, CRM, agenda, eventos, informes y preparación Google. |
| CRM 2 fundamento (`test:crm-foundation`) | PASA | Seis roles, RBAC, aislamiento, dinero, campos, vistas y reglas; modelo, API y navegador. |
| Comunicaciones (`test:communications`) | PASA | API, portal privado, soporte, adjuntos, no leídos y tenancy. |
| Comercio (`test:commerce`) | PASA | Catálogo, cupones, quote, checkout, pedidos, portal y dashboard. |
| Inteligencia (`test:crm-intelligence`) | PASA | Embudos, cohortes, atribución, objetivos, predicción y copiloto revisable. |
| Zona y rutas (`test:zone-discovery`) | PASA | Afinidad, fuentes, privacidad, UI, itinerario, perfiles y fallback. |
| QA visual | PASA | Incluida en la suite Studio y ejecutable de forma aislada. |
| E2E largo (`npm run test:studio-browser`) | FALLA | `Runtime.evaluate: Target crashed` mientras espera `data-studio-ready`. |
| Capturas históricas | PASA EN SU CORTE | Dieciséis vistas del 16 de julio; no representan todo el alcance del 23 de julio. |
| Proveedores productivos | NO VERIFICADO | Google, canales, pagos, IA y publicación remota requieren credenciales externas. |

## Cambios verificados por los guards

La refactorización no eleva el umbral del Studio. Extrae modelos/controladores de comercio, negocio, runtime público, chatbot, tienda, imágenes, introducción, entrega y ZIP. El guard comprueba sus scripts y mantiene `src/app.js` por debajo de 180.000 bytes.

El servidor ya no importa cada manejador API. `server/http/api-router.mjs` registra 39 familias públicas/protegidas; el guard valida que el manifiesto sea único y que `server/server.mjs` permanezca como composition root por debajo de 12.000 bytes.

## Smoke funcional

Salida final observada:

```text
Pilot smoke test passed.
Health: ok; contacts: 6; bookings: 1; events: 1.
Verified: admin auth, lead consent, booking consent, status changes,
monthly reports and Google readiness.
```

El script usa una copia temporal de los datos de ejemplo, levanta un servidor en un puerto libre y elimina el entorno temporal. No opera sobre el store productivo.

## E2E pendiente

El fallo del navegador no invalida las pruebas unitarias/contractuales ni el smoke, pero impide afirmar que la secuencia interactiva larga de edición, historial, entrega y descargas haya pasado en este equipo:

```text
Runtime.evaluate: Target crashed
Expression: document.documentElement.dataset.studioReady === "true"
```

Debe tratarse como deuda reproducible hasta estabilizar perfil, flags y consumo de recursos del navegador.

## Cobertura estructural

`package.json` expone 87 scripts. Se localizaron 91 archivos `test-*.mjs` y unas 2.754 apariciones de `assert`. Es una medida de amplitud, no un porcentaje de cobertura; no existe informe de líneas o ramas.

## Alcance de “pasa”

Las pruebas de proveedores usan dobles, fixtures o modos de desarrollo. No acreditan una cuenta productiva, autorización OAuth vigente, cobro liquidado, mensaje real ni despliegue externo.
