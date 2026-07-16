# Registro de contradicciones entre código y documentación

El registro no implica que los documentos fueran incorrectos en su fecha: indica que no deben usarse como descripción primaria del corte actual.

| ID | Afirmación documental | Evidencia actual | Evaluación |
|---|---|---|---|
| C-01 | `docs/AHORA.md:65`: `src/app.js` fue reducido de ~239 KB a 156 KB. | Archivo actual: 253.766 bytes. El guard de `server/scripts/test-studio-architecture.mjs:34` falla. | Histórica y ya no vigente. |
| C-02 | `docs/AHORA.md:15`: arquitectura frontend modular “protegida por pruebas”. | Hay modularización, pero el orquestador supera en 73.766 bytes su umbral. | Parcial; la protección detecta una regresión real. |
| C-03 | `docs/AHORA.md:19`: flujo principal verificado en navegador real. | `test:studio-browser` reproduce `Target crashed` en este entorno. Un recorrido CDP corto sí funciona. | No repetible como suite completa en el corte auditado. |
| C-04 | `docs/AHORA.md:98`: migración PostgreSQL pospuesta. | Driver PostgreSQL, migrador y Render Blueprint presentes (`business-store.mjs`, `render.yaml`). | Histórica. |
| C-05 | Memoria anterior `:22,60-64`: arquitectura MVP con persistencia JSON y base relacional futura. | Runtime dual JSON/PostgreSQL. | Histórica; JSON sigue vigente como modo local. |
| C-06 | Memoria anterior `:153,1300`: base relacional/SQLite como trabajo futuro. | PostgreSQL directo ya implementado. | Histórica. |
| C-07 | Memoria anterior `:156,1321`: OAuth Google por negocio como futuro. | OAuth, refresh, cifrado y endpoints Google conectados. | Histórica respecto al código; uso productivo no verificable. |
| C-08 | Memoria anterior `:1306`: añadir pruebas automatizadas. | 34 scripts y aproximadamente 1.012 aserciones; múltiples suites ejecutadas. | Histórica. |
| C-09 | Memoria anterior `:1106`: autenticación completa queda futura. | Hay token admin y login por negocio con scrypt/HMAC. No hay IAM general con roles internos. | Cambio parcial; la afirmación requiere matiz. |
| C-10 | `docs/CIBERSEGURIDAD.md:3`: stack Supabase DB/Auth. | No hay SDK/runtime Supabase; el propio documento lo admite en `:75-76`. | Solo documentación/plan. |
| C-11 | Checklists hablan de RLS y backups Supabase como fase de seguridad. | `SUPABASE_RLS_FASE_2.md:7-25` reconoce que es SQL/runbook no aplicado. | No implementado en el runtime. |
| C-12 | Memoria anterior agrupa Stripe/OpenAI/Google como “backends de ejemplo”. | Google pasó al backend principal; Stripe y OpenAI siguen en ejemplos/configuración. | Evolución desigual; no agruparlos bajo la misma madurez. |
| C-13 | Documentos de aceptación sugieren verificación de navegador dentro del cierre Studio. | `package.json` define `test:studio` sin `test:studio-browser`; además se detiene en arquitectura. | Contradicción entre procedimiento descrito y script real. |
| C-14 | Configuración Render/Cloudflare puede leerse como prueba de despliegue. | Solo demuestra intención y posibilidad técnica; no prueba que un servicio externo exista. | Debe etiquetarse [CONFIGURACIÓN], no [EJECUCIÓN]. |

## Criterio aplicado en la memoria

Los documentos históricos se citan solo para explicar evolución. Cuando una afirmación cambió, la memoria presenta primero el estado actual y después el contraste. No se han sobrescrito ni eliminado documentos anteriores.
