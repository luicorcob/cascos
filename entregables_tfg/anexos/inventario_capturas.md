# Inventario de capturas incluidas

Todas las imágenes se generaron el 16/07/2026 con el servidor real, Chrome y el fixture `evidencias/fixture-capturas.json`. Los nombres y operaciones son ficticios. La resolución desktop es 1440×1000; la captura móvil es 390×844 con densidad 2.

| Fig. | Archivo | Pantalla o flujo | Sección de la memoria | Afirmación respaldada |
|---:|---|---|---|---|
| 1 | `01-intro-studio.png` | Portada de entrada | Visión del sistema | Existe una entrada accesible y una identidad de suite. |
| 2 | `02-selector-destino.png` | Selector de áreas | Arquitectura funcional | La navegación conecta Studio, proyectos, Radar, brief, portal, tienda y visión. |
| 3 | `06-proyectos.png` | Inventario de proyectos | Gestión multi-negocio | La API carga un negocio, estado, plan y demo desde el fixture. |
| 4 | `03-studio-editor.png` | Studio en escritorio | Frontend / producción web | Editor y preview conviven; la captura acredita carga y render, no por sí sola la exportación. |
| 5 | `04-studio-preview-movil.png` | Viewport móvil del Studio | Responsive | El Studio cambia de viewport y el renderer aplica composición móvil. |
| 6 | `15-brief-onboarding.png` | Brief, paso 1 | Entrada de información | Onboarding multipaso accesible; procesamiento posterior se apoya en código/handoff. |
| 7 | `05-radar-modo-demostracion.png` | Radar con ejemplo | Prospección | Scoring/listado demo conectado; la propia UI etiqueta “datos simulados”. |
| 8 | `07-portal-bandeja.png` | Bandeja diaria | CRM y operación | Agregación de pendientes y siguientes acciones a partir del modelo. |
| 9 | `08-portal-pipeline-leads.png` | Pipeline CRM | CRM | Contactos ficticios agrupados por estado, valor y score. |
| 10 | `09-portal-propuestas.png` | Propuestas comerciales | Ventas | Formulario y módulo conectados; CRUD completo se acredita además por pruebas. |
| 11 | `10-portal-reservas.png` | Agenda, disponibilidad y bloqueo | Reservas | Datos persistidos del fixture y controles de agenda; validación completa por smoke. |
| 12 | `13-web-cliente.png` | Web generada desktop | Renderer y salida | La web final se produce con el renderer compartido y datos ficticios. |
| 13 | `16-web-cliente-movil.png` | Web generada móvil | Responsive | Adaptación real de la salida a 390 px. |
| 14 | `11-portal-reportes.png` | Resumen mensual en portal | Analítica | El portal consume agregados mensuales del backend. |
| 15 | `14-reporte-mensual.png` | Informe imprimible | Reporting | Métricas y embudo renderizados desde la API. |
| 16 | `12-portal-google-no-configurado.png` | Estado Google Ops | Integraciones | El módulo existe, pero informa honestamente que OAuth/cifrado/Places no están configurados. |

## Trazabilidad técnica por grupo

- Figuras 1, 2, 4 y 5: `index.html:25-277,1443-1462`, `src/app.js:39-77,219-245,2467-2799`.
- Figura 3: `src/business/projects.js:123-176,243-280`, `server/api/business-api.mjs`.
- Figura 6: `pages/onboarding.html`, `src/brief-experience.js`.
- Figura 7: `pages/business-radar.html:239-245`, `src/radar/business-radar.js:171-320`.
- Figuras 8–11, 14 y 16: `src/business/dashboard.js:1112-1154`, APIs CRM/reservas/reportes/Google.
- Figuras 12 y 13: `pages/client-site.html:28-32`, `src/business/client-site.js:43-78`.
- Figura 15: `src/business/monthly-report.js:61-123`, `server/api/report-api.mjs:25-70`.

## Nota probatoria

Una interfaz no acredita por sí sola el procesamiento. Por ello, las figuras de formularios y paneles se combinan en la memoria con los resultados de `smoke:pilot` y las pruebas API. No se presenta la figura 16 como prueba de una conexión Google real; prueba lo contrario: el sistema detecta la ausencia de preparación externa.
