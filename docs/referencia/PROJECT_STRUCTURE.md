# Project structure

Funcion: mapa tecnico de referencia. Las prioridades actuales se consultan en
[`../AHORA.md`](../AHORA.md).

```text
.
|-- index.html
|-- README.md
|-- .env.example
|-- Dockerfile
|-- render.yaml
|-- src/
|   |-- app.js
|   |-- business/
|   |-- shared/
|   `-- styles/
|-- pages/
|-- server/
|   |-- api/
|   |-- lib/
|   `-- scripts/
|-- examples/
|-- assets/
|-- data/
`-- docs/
    |-- AHORA.md
    |-- README.md
    |-- activo/
    |-- ventas/
    |-- producto/
    |-- operaciones/
    `-- referencia/
```

## Convenciones de codigo

- Mantener `index.html` en la raiz como entrada sencilla al Studio.
- Colocar interfaz y logica del Studio en `src/`.
- Colocar modulos del portal en `src/business/` y estilos dedicados en
  `src/styles/`.
- Colocar paginas auxiliares de navegador en `pages/`.
- Colocar servicios Node ejecutables en `server/` o `examples/`.
- Colocar datos operativos y copias en `data/`.

## Convenciones de documentacion

- `docs/AHORA.md` es el unico panel de prioridades.
- `docs/activo/` contiene el plan vinculante y trackers vivos.
- `docs/ventas/` contiene material para vender, cobrar y hacer onboarding.
- `docs/producto/` contiene calidad y decisiones funcionales.
- `docs/operaciones/` contiene despliegue, aceptacion y mantenimiento.
- `docs/referencia/` contiene contexto que no crea trabajo activo.

El inventario completo y las reglas de autoridad estan en
[`../README.md`](../README.md).

## Archivos tecnicos principales

- `pages/business-dashboard.html`: portal operativo del negocio.
- `pages/monthly-report.html`: reporte mensual imprimible.
- `src/business/dashboard.js`: carga API, tabs y metricas operativas.
- `src/business/monthly-report.js`: carga y render del reporte.
- `src/shared/api-config.js`: resolucion compartida de la URL de API.
- `server/server.mjs`: entrada del backend.
- `server/api/`: endpoints de negocios, contactos, reservas, eventos, salud y
  reportes.
- `server/lib/`: autenticacion, CORS, almacenamiento JSON y rate limiting.
- `server/scripts/`: validacion, seed, restauracion, smoke test y generacion de
  la memoria TFG.
- `.env.example`: plantilla de variables locales y de produccion.
- `render.yaml`: Blueprint de Render con healthcheck y disco persistente.

