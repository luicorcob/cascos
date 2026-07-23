<!--
Fuente editable de la memoria. Corte técnico de trabajo: 23 de julio de 2026, base 9eba88695ae39af83ab40a147f38ee88dc15a77a.
Los campos entre corchetes requieren confirmación del autor.
-->

# Resumen

DLS · Digital Local Sites es una aplicación web orientada a crear y operar la presencia digital de negocios locales. El sistema auditado integra una landing pública, un editor visual —DLS Studio—, gestión de proyectos, prospección, generación y publicación de webs, CRM multiempresa, portal privado, mensajería omnicanal, automatizaciones, campañas, propuestas y cobros configurables, reservas con recursos, comercio, reputación, fidelización, analítica e integración Google. También incorpora “Descubre tu zona”, con recomendaciones geográficas y cálculo de rutas. La solución utiliza HTML, CSS y JavaScript en el navegador, un servidor HTTP nativo de Node.js y una persistencia intercambiable entre documento JSON atómico y PostgreSQL con registros JSONB.

Esta memoria no parte de especificaciones históricas como fuente de verdad. Se ha elaborado mediante ingeniería inversa del repositorio, seguimiento de referencias entre módulos, revisión de configuración, ejecución aislada, pruebas automatizadas y capturas reales. El corte actualizado corresponde al estado de trabajo del 23 de julio de 2026, basado en el commit `9eba88695ae39af83ab40a147f38ee88dc15a77a` y en la refactorización modular descrita en este documento. Las capturas conservadas proceden del corte visual del 16 de julio y usan un fixture ficticio, sin cargar el `.env`, conectarse a bases remotas ni mostrar datos personales o credenciales; las funciones añadidas después se acreditan mediante código y pruebas, no mediante esas figuras históricas.

Los resultados confirman que el proyecto es una aplicación ejecutable y conectada, no una colección de maquetas. La validación sintáctica de 260 módulos, la suite Studio, los guards de arquitectura, la QA visual y el smoke integral superan sus comprobaciones. La refactorización reduce `src/app.js` de 253.865 a 163.228 bytes y `server/server.mjs` a 6.472 bytes; las 39 familias de API quedan registradas en un router único. La prueba E2E larga del Studio continúa provocando el cierre del objetivo del navegador en este entorno. Google, canales y pagos disponen de adaptadores conectados al servidor y pruebas con simulaciones o modo desarrollo, pero no se verificaron contra cuentas productivas.

**Palabras clave:** negocio local, editor web, CRM, automatización, reservas, Node.js, PostgreSQL, JavaScript, integración Google, digitalización.

# Abstract

DLS · Digital Local Sites is a web application designed to create and operate the digital presence of local businesses. The audited system combines a public landing page, a visual editor —DLS Studio—, project and opportunity management, website generation and publishing, a multi-tenant CRM, private client operations, omnichannel messaging, automations, campaigns, quotes, configurable payments, resource-aware bookings, commerce, reputation, loyalty, analytics, Google operations, and location-based recommendations and routes. Its runtime uses HTML, CSS and JavaScript in the browser, a native Node.js HTTP server, and interchangeable atomic JSON or PostgreSQL/JSONB persistence.

This report does not treat legacy documentation as the primary source of truth. It is based on repository reverse engineering, reference tracing, configuration review, isolated execution, automated tests, and real application screenshots. The updated working cut is dated 23 July 2026 and is based on commit `9eba88695ae39af83ab40a147f38ee88dc15a77a` plus the modular refactoring documented here. The retained screenshots belong to the 16 July visual cut and use fictional data; later functionality is supported by code and tests rather than by those historical figures.

The results show an executable and connected product rather than a set of mock-ups. Syntax checks across 260 modules, the Studio suite, architecture guards, visual QA, and the functional smoke test pass. The refactoring reduces `src/app.js` from 253,865 to 163,228 bytes and leaves a 6,472-byte server composition root backed by a 39-family API manifest. The long Studio browser test still crashes its target in this environment. Google, messaging channels, and payment adapters are connected and tested with simulations or development modes, but no live provider account was verified.

**Keywords:** local business, website builder, CRM, bookings, Node.js, PostgreSQL, JavaScript, Google integration, digitalisation.

# 1. Introducción

## 1.1 Objeto de la memoria

El objeto de este documento es describir técnicamente el sistema que existe en el repositorio auditado. La memoria diferencia entre comportamiento actual, configuración disponible, resultados de pruebas, inferencias justificadas, antecedentes históricos y extremos que no pueden verificarse localmente. Este criterio es necesario porque el proyecto conserva documentos redactados en momentos distintos: algunas decisiones que allí aparecen como futuras —PostgreSQL, autenticación de cliente, OAuth Google o pruebas automatizadas— ya cuentan con implementación; otras, como Supabase, siguen siendo planes o runbooks sin presencia en el runtime.

La aplicación observada propone un flujo amplio de digitalización. `index.html` es ahora una landing comercial y `workspace.html` concentra el acceso a Studio, proyectos, Radar, brief y herramientas. Las figuras 1 y 2 documentan la entrada anterior del Studio; siguen siendo evidencia del editor, pero ya no representan la página raíz vigente.

![Figura 1. Entrada principal de DLS Studio. La captura muestra la portada real desde la que se inicia el espacio de trabajo; acredita la carga de la aplicación y su identidad visual, no una operación de negocio.](capturas/originales/01-intro-studio.png)

![Figura 2. Selector de destino de la suite. La captura permite comprender la navegación entre producción, proyectos, prospección, brief, portal y comercio.](capturas/originales/02-selector-destino.png)

## 1.2 Problema abordado, según el sistema observable

**Inferencia con evidencia suficiente.** Los textos de interfaz, el catálogo de módulos y los flujos conectados indican que el sistema intenta reducir la fragmentación entre la creación de una web y la operación cotidiana de un negocio local. La solución reúne en una misma base técnica la producción del sitio, la captación de contactos, la agenda, el seguimiento comercial y los informes. Esta formulación describe la intención observable del producto; no sustituye a la motivación personal o académica del autor, que debe confirmarse.

## 1.3 Alcance actual

El alcance confirmado incluye:

- edición y previsualización de webs;
- layouts, imágenes, control de calidad y exportación;
- publicación de demos local o remota configurable;
- Control DLS multiempresa y portal privado separado para cada negocio;
- prospección Radar, traspaso de oportunidades y módulo “Descubre tu zona”;
- CRM con contactos, cuentas, oportunidades independientes, tareas, consentimiento y Cliente 360;
- usuarios de negocio, seis roles y autorización backend por recurso/acción;
- conversaciones, plantillas, secuencias, automatizaciones y campañas;
- propuestas versionadas, aceptación, calendario de pagos y quote-to-cash configurable;
- servicios, reservas, recursos, aforo, lista de espera, depósitos, cancelaciones y recordatorios;
- reputación, fidelización, referidos, eventos, objetivos, cohortes, predicciones y copiloto revisable;
- operaciones de hospitality y comercio conectadas al servidor principal;
- integración técnica con varias APIs de Google;
- landing generada con Tailwind y experiencia visual con GSAP/Three;
- persistencia JSON/PostgreSQL;
- seguridad HTTP, autenticación y logging;
- configuración Docker, Render y Cloudflare opcional.

Quedan fuera de lo que puede afirmarse como productivo: cuentas externas activas, usuarios o clientes reales, métricas de conversión, cumplimiento jurídico integral, adaptadores de pago/mensajería/IA operando con credenciales productivas y existencia de un servicio público concreto.

# 2. Metodología de auditoría y redacción

## 2.1 Principio de fuente de verdad

La jerarquía aplicada ha sido: comportamiento reproducido y pruebas ejecutadas; código conectado a puntos de entrada; configuración; inferencia explícita; documentación histórica. Un nombre de archivo, una dependencia instalada o un comentario no se consideraron suficientes para dar una funcionalidad por implementada.

Para cada módulo se comprobó, en la medida permitida por el entorno, su conexión con un punto de entrada, su activación desde la interfaz o el router, el tratamiento de datos y errores, la persistencia asociada y la existencia de pruebas. Los documentos antiguos solo se usaron para detectar evolución y contradicciones.

## 2.2 Inspección estática

La inspección cubrió el árbol del repositorio, manifiestos, HTML, CSS, JavaScript, servidor, APIs, librerías, scripts, datos de ejemplo, contenedores, configuración de despliegue, Worker, workflows y documentación. Se rastrearon importaciones, scripts cargados y referencias a módulos. El corte base contiene 1.986 archivos rastreados por Git; 1.401 están bajo `node_modules`, una anomalía de mantenimiento pese a que `.gitignore` ya excluye esa carpeta.

## 2.3 Ejecución controlada

Se dedujeron los comandos desde `package.json`. La aplicación se ejecutó con Node.js y el servidor real. Para las capturas se creó un directorio de trabajo temporal, se forzó `BUSINESS_STORE=json`, se anularon las URLs de PostgreSQL, se desactivaron backups y se usó un fixture ficticio. El proceso no cargó el `.env` del proyecto y se cerró al finalizar.

El fixture representa “Luma Café — entorno de prueba” y usa `example.test`, teléfonos no reales y textos que avisan del carácter simulado. El endpoint de salud confirmó el modelo cargado antes del recorrido visual.

## 2.4 Pruebas

Se ejecutaron la validación sintáctica, suites Studio y backend, smoke funcional, QA visual y prueba de navegador. Los resultados se explican en el capítulo 15 y en el anexo de pruebas. “Prueba superada” se limita al alcance de sus aserciones; no se equipara una simulación de proveedor con una cuenta productiva.

## 2.5 Evidencia visual

Las dieciséis figuras proceden de la aplicación ejecutada. Antes de cada captura se esperó al DOM requerido y a la estabilización de imágenes. Las capturas de formularios no se usan como única evidencia de procesamiento: se relacionan con rutas API y pruebas funcionales. El catálogo completo se conserva en `anexos/inventario_capturas.md`.

# 3. Visión general del sistema

## 3.1 Áreas funcionales

DLS se organiza en cuatro planos conectados:

1. **Adquisición y producción DLS:** landing, brief, Radar, Studio y proyectos.
2. **Control interno:** cartera multiempresa, producción, servicios, facturación, cobros, accesos y soporte.
3. **Operación del negocio:** portal privado, CRM, reservas, equipo, comercio, reputación, crecimiento, Google e informes.
4. **Canal público:** web generada, formularios, reservas, eventos, chatbot, tienda y recomendaciones de zona.

El mismo registro de negocio actúa como nexo. Contiene identidad, marca, contenido, integraciones y configuración. Las colecciones funcionales aplican `businessId`; las asociaciones permiten relacionar personas, cuentas, oportunidades, propuestas, reservas, pagos, proyectos, campañas y conversaciones sin convertir el contacto en contenedor de todo el ciclo.

## 3.2 Actores deducidos

El código distingue cuatro clases de actor y, para usuarios del negocio, seis roles efectivos:

- equipo administrador DLS, autenticado mediante token admin;
- cliente de un negocio, autenticado con contraseña y token limitado al negocio/áreas;
- usuario del negocio autenticado mediante sesión firmada y rol `owner`, `manager`, `sales`, `operations`, `finance` o `viewer`;
- visitante público, que accede a la web y a endpoints de captación, reservas y eventos con rate limit.

`businessUsers`, `business-access.mjs` y la API de seguridad implementan una matriz backend por recurso y acción, auditoría y suplantación controlada. El token admin de DLS sigue siendo un mecanismo separado y no constituye un usuario nominal del mismo IAM.

## 3.3 Estado observado

El Studio, Radar demo, proyectos, portal, web de cliente, informe y onboarding cargaron correctamente en el corte visual. Después se añadieron una landing pública, Control DLS, un portal cliente separado, superficies de hospitality/comercio y Descubre tu zona. Esas incorporaciones están conectadas a sus puntos de entrada y cubiertas por suites específicas; no deben atribuirse a las capturas anteriores.

![Figura 3. Inventario de proyectos alimentado por la API. Se muestra un negocio ficticio, su estado, plan y demo; el dato procede del fixture cargado por el backend.](capturas/originales/06-proyectos.png)

# 4. Arquitectura

## 4.1 Vista lógica

La arquitectura se deduce como un monolito modular ligero con frontend multipágina y extensiones externas opcionales.

```text
┌──────────────────────────────── Navegador ────────────────────────────────┐
│ Studio │ Radar │ Proyectos │ Portal │ Web cliente │ Informe │ Brief      │
│ módulos DOM + namespace LocalLiftStudio + fetch JSON                     │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │ HTTP/JSON
┌───────────────────────────────▼───────────────────────────────────────────┐
│ Servidor Node nativo                                                      │
│ router modular · auth · CORS · guards · rate limit · logging             │
│ negocios · CRM · agenda · propuestas · informes · Google · imágenes      │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │ adaptador
                 ┌──────────────┴──────────────┐
                 │ JSON atómico │ PostgreSQL   │
                 └──────────────┬──────────────┘
                                │ opcional
        Google · OSM · bancos de imagen · Cloudflare · servicios separados
```

El servidor principal se inicia con `node server/server.mjs`. No se requiere compilación ni bundle para el frontend. Esta simplicidad favorece la inspección y la exportación standalone, pero traslada al navegador la responsabilidad de cargar scripts en orden.

## 4.2 Puntos de entrada

- `index.html`: landing comercial pública.
- `workspace.html`: entrada del Studio y centro de herramientas de producción.
- `server/server.mjs`: composición HTTP, seguridad transversal y servicio estático.
- `server/http/api-router.mjs`: manifiesto y despacho ordenado de 39 familias de API.
- `pages/admin-dashboard.html`: Control DLS para operación multiempresa.
- `pages/client-dashboard.html`: portal privado de cada negocio.
- `pages/business-dashboard.html`: superficie operativa histórica, conservada por compatibilidad.
- `pages/business-radar.html`: prospección.
- `pages/projects.html`: gestión de proyectos.
- `pages/client-site.html`: web generada desde un registro.
- `pages/monthly-report.html`: salida imprimible.
- `pages/onboarding.html`: brief.
- `pages/zone-playground.html`: exploración y prueba de Descubre tu zona/Modo Ruta.
- `pages/store-admin.html`: administración de comercio conectada al servidor principal.
- `pages/proposal.html`: visualización y aceptación pública de propuestas.
- `examples/*.example.mjs`: extensiones didácticas opcionales; no son la única implementación de comercio o canales.

## 4.3 Organización frontend

Los módulos Studio publican fábricas explícitas en `window.LocalLiftStudio`; `src/app.js` actúa como composition root y entrega a cada controlador solo el estado y las operaciones que necesita. Esta estrategia mantiene el frontend ejecutable como scripts clásicos, sin introducir un empaquetador, y permite que `pages/client-site.html` reutilice `core-utils`, `catalog` y `renderer`.

La refactorización de este corte extrajo del antiguo orquestador ocho fronteras funcionales y un servicio de archivo:

| Módulo | Responsabilidad |
|---|---|
| `commerce-model.js` | normalización de producto, envío y configuración comercial |
| `business-model.js` | valores por defecto, importación y estilos del negocio |
| `public-runtime.js` | formularios públicos, atribución, eventos y sincronización |
| `chatbot-controller.js` | widget, conversación local/remota y captación |
| `storefront-controller.js` | catálogo, carrito, configuración, presupuesto y checkout |
| `site-image-controller.js` | packs visuales, proveedores, biblioteca y handoff de Radar |
| `intro-controller.js` | entrada, ayuda, login y navegación del workspace |
| `delivery-controller.js` | exportación, demo, paquete, descarga y compartibilidad |
| `zip-archive.js` | creación ZIP y CRC32 sin dependencias externas |

`src/app.js` ha pasado de 253.865 a 163.228 bytes y queda por debajo del guard de 180.000 bytes. El resultado no elimina toda la deuda: el archivo sigue coordinando una interfaz grande y `src/business/dashboard.js`, con 522.425 bytes y 10.873 líneas, es la siguiente frontera prioritaria. Los nuevos módulos tienen una prueba aislada de contrato además de las suites existentes.

## 4.4 Organización backend

`server/server.mjs` es ahora una raíz de composición: construye el store, aplica CORS, cabeceras, límites, logging, autenticación administrativa y servicio estático. El conocimiento de las APIs se concentra en `server/http/api-router.mjs`, que declara un manifiesto de 39 familias, diferencia rutas públicas y protegidas y conserva un orden único de despacho. Los manejadores de `server/api/` siguen encapsulando validación y dominio; el servidor ya no importa cada uno individualmente.

La separación reduce `server/server.mjs` a 6.472 bytes y evita que añadir una API vuelva a inflar la infraestructura HTTP. Un guard comprueba tamaño, unicidad del manifiesto y ausencia de importaciones directas de manejadores desde el composition root.

La solución no usa Express. El control HTTP —cuerpo, CORS, cabeceras, rutas y errores— se implementa con módulos propios. Esto reduce dependencias pero aumenta la cantidad de infraestructura que debe mantenerse y probarse internamente.

# 5. DLS Studio y generación web

## 5.1 Edición y preview

El Studio reúne controles de contenido, dirección visual, orden de secciones, biblioteca de bloques, imágenes, responsive y preparación de entrega. El renderer genera la web dentro de un marco de navegador. La figura 4 muestra el editor y un preview realmente renderizado; no es una maqueta incorporada a la memoria.

![Figura 4. DLS Studio en vista de escritorio. El panel de edición y el preview comparten el estado del negocio; la imagen verifica la carga del editor y del renderer.](capturas/originales/03-studio-editor.png)

La aplicación proporciona historial, undo/redo y autosave sobre `localStorage`. El botón de guardado conserva una copia local y, si existe contexto API, sincroniza el negocio con el backend. También puede cargar desde almacenamiento local o desde la API.

## 5.2 Modelo visual

El catálogo permite combinar tema, dirección artística, tipografía, densidad, forma, proporción de imagen y variantes de bloques. El renderer normaliza esos valores y produce una estructura `.generated-site` con clases de tema y composición. El código responsive se comparte entre Studio, web de cliente y exportación.

La figura 5 muestra el cambio de viewport dentro del Studio. Esta evidencia demuestra que el control de viewport responde y que el CSS adapta la composición; no sustituye a una auditoría exhaustiva en todos los dispositivos.

![Figura 5. Preview móvil dentro del Studio. Se observa la misma web reorganizada en un marco estrecho y con acciones de conversión adaptadas.](capturas/originales/04-studio-preview-movil.png)

## 5.3 Recursos e imágenes

El Studio contiene una colección curada y dos APIs de servidor:

- stock genérico, con Unsplash si hay clave y Wikimedia Commons como alternativa;
- packs de imágenes de sitio, capaces de consultar Unsplash, Pexels y Pixabay según credenciales;
- seguimiento del endpoint de descarga exigido por Unsplash;
- normalización de URLs, proveedores, autoría y licencia mostrada.

Las pruebas sustituyen las llamadas externas para comprobar selección y formato. No se ha verificado la licencia final de cada imagen incluida históricamente en catálogos; debe revisarse antes de una explotación pública.

## 5.4 Validación y entrega

La validación del negocio, el control de calidad y la QA visual detectan campos incompletos, contraste, estructura, imágenes y preparación de entrega. La salida puede adoptar tres formas:

- HTML standalone descargable;
- datos JSON reutilizables;
- paquete ZIP con HTML, `business.json`, ficha y registro de cambios.

El mismo renderer se usa para preview y salida, lo que reduce divergencias. La publicación de demo es una operación diferente: guarda HTML en filesystem o lo envía a un publicador remoto con TTL. La interfaz explica esta separación.

# 6. Onboarding y Radar

## 6.1 Brief de onboarding

El onboarding divide la entrada de información en identidad, conversión, contenido, recursos, chatbot y entrega. El progreso se calcula a partir de campos clave y el resultado puede transferirse al Studio. La figura 6 muestra el primer paso del flujo; el procesamiento se acredita además por el código de handoff.

![Figura 6. Primer paso del brief de onboarding. El formulario captura identidad y contexto del negocio antes de generar una configuración para el Studio.](capturas/originales/15-brief-onboarding.png)

## 6.2 Descubrimiento de oportunidades

Radar dispone de un proveedor de demostración y un proveedor OpenStreetMap. En modo OSM, el backend y el cliente usan servicios geográficos para buscar negocios; el cliente calcula señales de oportunidad y muestra lista, métricas, recomendaciones y mapa. La ausencia de una web declarada en la fuente no se interpreta como certeza absoluta de que el negocio no tenga web.

La captura se realizó en modo demo para evitar depender de red y de datos de terceros. La propia interfaz muestra “Ejemplo · datos simulados”, por lo que no debe presentarse como una búsqueda real.

![Figura 7. Radar en modo de demostración. Se muestran métricas y oportunidades simuladas, claramente etiquetadas, para explicar el flujo de scoring sin atribuir datos a negocios reales.](capturas/originales/05-radar-modo-demostracion.png)

## 6.3 Traspaso al Studio

Una oportunidad puede transformarse en brief: se normalizan nombre, categoría, localidad, señales, datos de contacto y recursos. El endpoint `/api/studio/from-opportunity` y el módulo `studio-handoff` conectan las dos áreas. La prueba específica de handoff pasa. La integración no depende de que la búsqueda sea live: también se puede ensayar con fixture.

## 6.4 Descubre tu zona y Modo Ruta

La evolución posterior al corte visual añade una experiencia pública de descubrimiento local y una herramienta operativa de rutas. La API pública entrega recomendaciones filtradas por negocio, categoría y contexto; la configuración privada permite activar el módulo, ajustar su radio y refrescar métricas. `zone-discovery-service.mjs` coordina datos del negocio, OpenStreetMap y Wikimedia, normaliza resultados y degrada de forma explícita cuando una fuente externa no responde.

Modo Ruta calcula recorridos mediante OSRM con perfiles separados para coche, a pie y bicicleta. Las variables `OSRM_BASE_URL_CAR`, `OSRM_BASE_URL_FOOT` y `OSRM_BASE_URL_BIKE` permiten desplegar motores distintos; cuando no existe una ruta remota utilizable, el sistema conserva una alternativa geométrica y marca la procedencia para no presentar una estimación como respuesta exacta del proveedor. Las suites `test:zone*` cubren contratos, privacidad pública, persistencia, métricas, rutas y escenarios de fallo. Esta funcionalidad no aparece en las dieciséis capturas históricas y se acredita por implementación y pruebas.

# 7. Portal operativo y CRM

## 7.1 Control DLS y portal cliente

La operación se divide ahora en dos superficies. `pages/admin-dashboard.html` ofrece Control DLS para cartera, producción, servicios, facturación, cobros, accesos y soporte multiempresa. `pages/client-dashboard.html` es el portal privado de un negocio y reúne CRM, agenda, comercio, reputación, crecimiento, integraciones e informes. La vista histórica `business-dashboard.html` se conserva por compatibilidad, pero ya no es el único punto operativo.

El backend mantiene dos niveles de identidad: el token administrativo de DLS y las sesiones firmadas de usuarios del negocio. Estas últimas aplican seis roles y permisos por recurso/acción; la autorización no depende solo de ocultar pestañas en el navegador.

## 7.2 Bandeja diaria

La bandeja agrega vencimientos, leads sin primer contacto, reservas del día, propuestas pendientes, conversaciones y clientes a reactivar. En la figura 8 se observan los indicadores del fixture sobre la interfaz histórica. El cálculo de secciones y sus acciones se prueba mediante las suites de inbox y automatización.

![Figura 8. Bandeja diaria del portal. La vista agrega pendientes y siguientes acciones del negocio ficticio; el procesamiento se valida también con pruebas de inbox.](capturas/originales/07-portal-bandeja.png)

## 7.3 Cliente 360, cuentas y oportunidades

El modelo dejó de concentrar todo el ciclo comercial en el contacto. Mantiene personas y consentimiento, e incorpora cuentas, oportunidades independientes, tareas, asociaciones y una vista Cliente 360. Una oportunidad tiene pipeline, etapa, importe monetario normalizado, probabilidad, responsable, próxima acción y motivo de pérdida. La API permite:

- crear y actualizar contactos, cuentas, oportunidades y tareas;
- relacionar entidades sin duplicar sus datos;
- cambiar etapa, estado, responsable y orden;
- exigir motivo al cerrar una pérdida;
- detectar duplicados y fusionar contactos de forma blanda;
- registrar actividades y timeline;
- programar o modificar siguiente acción;
- recalcular score y salud del cliente;
- consultar embudos, forecast y calidad de datos.

La figura 9 representa el pipeline histórico basado en leads. La deduplicación, los motivos de pérdida, el score, las nuevas oportunidades y la persistencia se apoyan en smoke y suites CRM 2, no únicamente en la imagen.

![Figura 9. Pipeline de leads. Los contactos ficticios aparecen por estado, valor y temperatura; la API permite mover, puntuar y fusionar registros.](capturas/originales/08-portal-pipeline-leads.png)

## 7.4 Conversaciones, automatizaciones y campañas

La mensajería ya no se limita a construir enlaces `wa.me` o `mailto`. El servidor gestiona conversaciones, mensajes, plantillas y estados de entrega mediante adaptadores de canal; conserva asimismo el modo de desarrollo para probar sin cuentas externas. Las secuencias y automatizaciones se ejecutan con condiciones, acciones, reintentos, auditoría e idempotencia. Las campañas incorporan audiencias, consentimiento, exclusiones, variantes y resultados.

Esta implementación permite afirmar que existe orquestación omnicanal en el servidor principal. No permite afirmar que WhatsApp, correo u otros proveedores hayan enviado mensajes productivos durante la auditoría, porque no se utilizaron credenciales reales.

## 7.5 Propuestas y quote-to-cash

El módulo enlaza una propuesta versionada a un contacto, cuenta u oportunidad. Incluye líneas, descuentos, impuestos, condiciones, vencimiento, aceptación pública, calendario de pagos y trazabilidad hasta el cobro. Los importes se guardan como unidades monetarias enteras y la API aplica separación por negocio, transiciones e idempotencia. El exportador produce HTML y PDF.

La figura 10 muestra la interfaz anterior de creación; las pruebas de propuestas, aceptación, pagos y conversión completan la evidencia del flujo actual.

![Figura 10. Módulo de propuestas comerciales. El formulario se alimenta de contactos del CRM; creación, transiciones y exportación están cubiertas por pruebas específicas.](capturas/originales/09-portal-propuestas.png)

## 7.6 Reputación, fidelización y operaciones verticales

CRM 2 añade solicitudes de reseña, respuestas revisables, objetivos de reputación, programas de puntos, niveles, recompensas y referidos. Las operaciones verticales amplían el mismo núcleo con entidades configurables para hospitality y comercio. La implementación comparte `businessId`, auditoría, permisos y adaptadores de persistencia, evitando mantener un segundo backend inconexo.

# 8. Agenda y reservas

## 8.1 Entidades y reglas

La agenda combina servicios, recursos, sedes, reglas semanales, bloqueos, aforo, reservas, lista de espera, políticas y recordatorios. Un servicio define duración, precio, descripción, depósito y requisitos; el recurso permite asignar profesional, mesa, sala u otra capacidad concreta. La disponibilidad y las excepciones regulan intervalos; la reserva vincula servicio, recurso, contacto, datos del cliente, inicio/fin, origen, consentimiento y estado de pago.

## 8.2 Flujo público

El visitante envía una reserva al endpoint público del negocio. El backend:

1. valida cuerpo y consentimiento;
2. localiza negocio y servicio;
3. calcula fin según duración;
4. resuelve recurso y comprueba disponibilidad, aforo, bloqueos y solapes;
5. crea o relaciona el contacto;
6. aplica depósito, política de cancelación o lista de espera cuando corresponda;
7. persiste reserva y actividad;
8. devuelve el resultado.

El smoke ejecutó el flujo básico con datos temporales y creó un recordatorio. Las suites de reservas avanzadas comprueban además recursos, capacidad, waitlist, checkout y políticas. La figura 11 muestra el estado histórico de agenda del fixture, incluidos horarios y un bloqueo ficticio.

![Figura 11. Agenda de reservas. Se muestran disponibilidad semanal y un bloqueo ficticio; la validación y persistencia de una reserva se comprobaron mediante el smoke funcional.](capturas/originales/10-portal-reservas.png)

## 8.3 Recordatorios y Calendar

Los recordatorios se preparan por canal, quedan en una cola con estado y se entregan mediante la capa de adaptadores configurada. El modo desarrollo permite verificar el ciclo sin enviar mensajes externos. Google Calendar puede consultar free/busy, crear eventos y sincronizar una reserva cuando existe OAuth. No se ejecutaron envíos ni sincronización con cuentas productivas.

# 9. Web pública, conversión y responsive

## 9.1 Renderer compartido

`pages/client-site.html` carga utilidades, catálogo y renderer del Studio. Obtiene el registro de negocio desde la API, lo convierte al modelo visual y monta la web. A continuación conecta formularios de lead, reserva, carrito, chatbot y eventos.

La figura 12 utiliza un registro ficticio y muestra un aviso inequívoco de demostración. Esto evita confundir la evidencia con un cliente real.

![Figura 12. Web generada para el negocio ficticio. La salida desktop reutiliza el renderer del Studio e incorpora navegación y llamadas a la acción.](capturas/originales/13-web-cliente.png)

## 9.2 Captación y eventos

Los formularios públicos envían leads y reservas a rutas ligadas al slug del negocio. El evento de conversión registra nombre, detalle, UTM, página, referrer y agente. El rate limit separa categorías de endpoint. Los consentimientos de lead y reserva se almacenan y fueron verificados en el smoke.

## 9.3 Chatbot

El renderer admite chatbot local o remoto. En modo local, responde con reglas y contexto del negocio sin servicio externo. Si existe endpoint, envía la conversación a ese servicio. El ejemplo OpenAI demuestra cómo implementar un endpoint con Responses API, pero no forma parte del router principal.

## 9.4 Comercio visual

La web puede mostrar productos, variantes, carrito, entrega, cupones y acciones de checkout. El catálogo embebido funciona como fallback; cuando existe contexto de negocio, `commerce-api.mjs` expone stock, carrito/pedido y configuración desde el servidor principal. La capa de pagos soporta modo de desarrollo y Stripe configurable, con webhook e idempotencia. El ejemplo independiente se mantiene como referencia, pero ya no representa el único backend comercial.

Las pruebas confirman contratos, cálculo e integración interna. Como no se usó una cuenta Stripe real, la memoria no atribuye cobros productivos ni liquidaciones externas.

## 9.5 Adaptación móvil

La figura 13 se capturó a 390×844. La navegación se vuelve desplazable, el hero reorganiza texto y acciones, y el dock de conversión permanece accesible. Se observa una salida real del renderer, no una imagen rediseñada para este documento.

![Figura 13. Web del negocio ficticio en viewport móvil. La composición, navegación y llamadas a la acción se adaptan a 390 px de anchura.](capturas/originales/16-web-cliente-movil.png)

# 10. Informes y analítica

## 10.1 Reporte mensual

El endpoint mensual agrega contactos, reservas, recordatorios, pedidos y eventos para un periodo. El cliente imprime métricas, embudo, fuentes, estados de reserva, conversiones, actividad y recomendaciones. Los importes de comercio se derivan de pedidos almacenados en el modelo del negocio; no implican cobros Stripe reales.

La figura 14 muestra el resumen dentro del portal y la figura 15 la salida imprimible completa.

![Figura 14. Pestaña de reportes del portal. El resumen mensual consume métricas agregadas para el negocio ficticio.](capturas/originales/11-portal-reportes.png)

![Figura 15. Informe mensual imprimible. La API y el cliente presentan contactos, reservas, recordatorios, ingresos de prueba y fuentes del periodo.](capturas/originales/14-reporte-mensual.png)

## 10.2 Informes comerciales adicionales

El backend ofrece:

- motivos de pérdida;
- embudos y forecast de oportunidades, propuestas y cobros;
- cumplimiento SLA y tiempos de primera respuesta;
- dashboard comercial agregado;
- calidad de datos;
- inbox operativo;
- cohortes, objetivos, atribución y valor;
- predicciones y recomendaciones revisables del copiloto.

Las pruebas verifican separación por negocio, fechas, agregaciones y casos límite. Las predicciones se presentan con señales y nivel de confianza; una acción sugerida no se ejecuta silenciosamente. Estos informes no se traducen en una métrica académica de impacto: describen datos operativos del modelo.

## 10.3 Inteligencia operativa

La capa de inteligencia combina datos del CRM, reservas, conversaciones, reputación, fidelización y comercio para generar indicadores accionables. Incluye objetivos con progreso, análisis de cohortes, riesgo de pérdida, próxima mejor acción y un copiloto con registro de decisiones. El diseño mantiene las salidas como recomendaciones auditables y no como decisiones autónomas irreversibles. Sus pruebas emplean datos controlados, por lo que no demuestran precisión estadística sobre una población real.

## 10.4 Exportación

Los paneles permiten exportar entidades operativas en CSV. Las propuestas tienen salida HTML/PDF y el informe mensual puede imprimirse. La memoria evita afirmar que existe un pipeline de BI externo o almacenamiento analítico separado, porque no aparece en el runtime.

# 11. Persistencia y modelo de datos

## 11.1 Persistencia JSON

El modo JSON guarda un documento agregado con alrededor de noventa colecciones. Además del negocio y el CRM básico, cubre usuarios/permisos, cuentas, oportunidades, tareas, consentimiento, conversaciones, mensajes, automatizaciones, campañas, propuestas y pagos, recursos y reservas, comercio, reputación, fidelización, inteligencia y auditoría. La escritura se realiza a un temporal y después se renombra, evitando reemplazos parciales. Los backups son configurables.

Este modo es apropiado para desarrollo y demostraciones controladas. Su principal límite es la coordinación entre procesos: la atomicidad del archivo no equivale a control relacional o transaccional multiinstancia.

## 11.2 Persistencia PostgreSQL

El store PostgreSQL crea una tabla por colección. Cada fila guarda identificadores e índices básicos junto con `data JSONB`. La operación de reemplazo usa transacción y `pg_advisory_xact_lock`; una tabla meta conserva información general. Render configura `BUSINESS_STORE=postgres` e inyecta `DATABASE_URL`.

**Inferencia.** El diseño migra el documento a una infraestructura concurrente sin normalizar todas sus relaciones. Esta decisión reduce el acoplamiento de una migración temprana, aunque la integridad referencial depende principalmente de la aplicación.

## 11.3 Modelo resumido

| Entidad | Relaciones y finalidad |
|---|---|
| Negocio | Raíz de tenant; marca, contenido, configuración, integraciones y demo. |
| Usuario/rol | Pertenece a negocio; sesión, estado y permisos por recurso/acción. |
| Contacto/cuenta | Personas y organizaciones con consentimiento, asociaciones y Cliente 360. |
| Oportunidad/tarea | Ciclo comercial independiente del contacto, con importe, etapa, responsable y seguimiento. |
| Actividad/conversación | Timeline, mensajes, canal, SLA y estado de entrega. |
| Automatización/campaña | Disparadores, condiciones, audiencias, ejecuciones e idempotencia. |
| Propuesta/pago | Oferta versionada, aceptación, calendario, intento y conciliación. |
| Servicio/recurso | Duración, precio, capacidad, profesional/sala y reglas de reserva. |
| Reserva/waitlist | Contacto, servicio, recurso, horario, depósito, estado y políticas. |
| Producto/pedido | Catálogo, stock, cupón, entrega, checkout y estado comercial. |
| Reputación/fidelización | Reseñas, solicitudes, puntos, niveles, recompensas y referidos. |
| Evento/objetivo | Señal atribuida, métrica, cohorte y progreso analítico. |
| Auditoría | Registra mutaciones relevantes. |

## 11.4 Tenancy

La separación se implementa aplicando `businessId` en lecturas y escrituras, autorizando tokens contra negocio y áreas y evaluando la matriz RBAC para usuarios internos. Las pruebas de propuestas, reportes, seguridad y CRM incluyen escenarios de dos tenants. No existe un esquema por tenant ni Row Level Security de base de datos en el runtime principal.

# 12. Integraciones externas

## 12.1 Google

El backend principal contiene OAuth por negocio, callback, refresh, desconexión, diagnósticos, Places, Calendar, Business Profile y Workspace. Los tokens se cifran con AES-256-GCM; el estado OAuth se guarda como hash con una vida de diez minutos.

La figura 16 es deliberadamente una evidencia de estado no configurado. Muestra botones y diagnósticos del módulo, pero también que OAuth, cifrado y Places no están preparados en el entorno. No se incluye una captura inventada de conexión exitosa.

![Figura 16. Google Ops sin credenciales externas. La interfaz confirma la existencia del módulo y, al mismo tiempo, muestra que OAuth, cifrado, Places y servicios conectados no están disponibles en el entorno de prueba.](capturas/originales/12-portal-google-no-configurado.png)

Las pruebas Google usan respuestas simuladas. Permiten afirmar que el código forma solicitudes y procesa respuestas, no que una cuenta de Google haya concedido scopes o que Business Profile esté habilitado.

## 12.2 Geografía y mapas

Radar utiliza OpenStreetMap como modo por defecto, Nominatim/Overpass para descubrimiento y Leaflet/MarkerCluster para mapa. Descubre tu zona combina además resultados OSM con medios de Wikimedia, y Modo Ruta consulta OSRM mediante perfiles configurables de coche, peatón y bicicleta con fallback explícito. Leaflet se carga desde unpkg; una caída o restricción del CDN afecta al mapa, aunque el listado y las degradaciones del servicio pueden seguir procesándose.

## 12.3 Proveedores visuales

Unsplash, Wikimedia Commons, Pexels y Pixabay aportan imágenes según configuración. El backend filtra y normaliza URLs y conserva metadatos. Para una entrega pública debe mantenerse la atribución y revisar las condiciones de cada proveedor.

## 12.4 Cloudflare

El Worker permite publicar HTML en KV con caducidad y token compartido. Replica cabeceras de seguridad. Los tests locales pasan. No hay evidencia de que el Worker esté desplegado ni de que un dominio esté vinculado.

## 12.5 Canales, pagos e IA

El servidor principal contiene adaptadores de canales y pagos, incluyendo modos de desarrollo, Stripe configurable y transporte de correo según entorno. Los ejemplos independientes de comercio y chatbot se conservan como material de referencia; el chatbot remoto con OpenAI Responses continúa siendo optativo y no convierte a OpenAI en requisito del núcleo. La auditoría valida contratos y simulaciones, no operaciones contra cuentas productivas de Stripe, Resend, WhatsApp u OpenAI.

# 13. Seguridad

## 13.1 Autenticación administrativa

Las rutas sensibles aceptan Bearer o `X-LocalLift-Admin-Token`. La comparación usa `timingSafeEqual`. En desarrollo, la ausencia de token permite el modo local abierto; en producción el validador exige una credencial. Este comportamiento facilita el uso local, pero requiere controlar correctamente `NODE_ENV`.

## 13.2 Autenticación de cliente

Las contraseñas se almacenan como `scrypt:salt:hash`. Tras verificarla, el servidor genera un token con payload y firma HMAC SHA-256; el TTL por defecto es de catorce días. El cliente lo conserva en `localStorage` y lo envía en una cabecera. El backend limita el negocio y las áreas permitidas.

Riesgo: `localStorage` no es inmune a XSS. La medida complementaria debe ser reducir inyección y endurecer la política de contenido. En el corte actual, la CSP todavía permite scripts y estilos inline.

## 13.3 Usuarios de negocio y RBAC

La API de seguridad administra usuarios, sesiones, revocación, roles y auditoría. Los roles `owner`, `manager`, `sales`, `operations`, `finance` y `viewer` se traducen en permisos backend por recurso y acción. La interfaz usa esos permisos para presentar capacidades, pero la comprobación decisiva se repite en el servidor. La suplantación administrativa es explícita y auditada.

## 13.4 Seguridad HTTP

El servidor aplica:

- rechazo de TRACE;
- límite de URL y cuerpo;
- exigencia de JSON en métodos mutantes;
- CORS configurable;
- CSP, `nosniff`, `SAMEORIGIN`, políticas de referrer/permisos y HSTS en producción;
- `Cache-Control: no-store` para API;
- prevención de path traversal;
- límites por IP y categoría de endpoint;
- mensajes de error estructurados sin exponer la traza al cliente.

Los límites viven en memoria y no se comparten entre réplicas. Además, el primer `X-Forwarded-For` se acepta sin una política explícita de proxies de confianza. Son límites relevantes si el sistema escala.

## 13.5 Secretos y OAuth

El `.env` está ignorado por Git. Durante la auditoría solo se comprobó la presencia de nombres de variables, nunca sus valores. Los tokens Google se cifran; el logger redacta claves cuyo nombre parece sensible. La CI incluye auditoría de dependencias y un script busca patrones de secretos.

No puede demostrarse desde el repositorio que ningún secreto histórico haya sido filtrado o que todos los proveedores hayan rotado claves. Tampoco se verificó WAF, DNS o backup externos.

## 13.6 Privacidad

Los endpoints públicos almacenan aceptación, fecha y URL de política para leads/reservas. Esto es una base técnica, no una certificación RGPD. Faltan evidencias externas sobre base jurídica, información al interesado, contratos, conservación, ejercicio de derechos y procedimientos reales.

# 14. Ejecución, configuración y despliegue

## 14.1 Comandos comprobados

- `npm start`: servidor local.
- `npm run start:prod`: valida el entorno y arranca.
- `npm run check`: descubre y valida sintácticamente todos los `.js`/`.mjs` de las áreas de runtime y pruebas.
- `npm run smoke:pilot`: smoke funcional aislado.
- `npm run test:studio`: suite compuesta Studio.
- `npm run test:architecture`: guards del Studio y del servidor.
- `npm run test:zone-discovery`: contratos de descubrimiento y rutas.
- scripts específicos para las fases CRM 2, operaciones, comunicaciones, hospitality, comercio, Google, seguridad, QA y despliegue.

El proyecto declara cinco dependencias runtime directas —Atropos, GSAP, `pg`, Stripe y Three— y dos dependencias de desarrollo para Tailwind. Parte de las librerías visuales también se guarda en `assets/vendor`.

## 14.2 Variables

La configuración cubre host/puerto, entorno, token admin, sesiones, store, PostgreSQL, backups, CORS, rate limits, Google, proveedores de imagen, canales, pagos, OSRM por perfil, publicador de demos y logging. Las variables reales no se incluyen en la memoria.

## 14.3 Docker y Render

El contenedor usa Node 22 Alpine, instala dependencias de producción, expone el servidor y define healthcheck. El Blueprint de Render configura un servicio web, PostgreSQL gestionado, disco persistente y un cron de automatización diaria.

**Clasificación:** esto confirma preparación de despliegue. Sin URL, panel o respuesta externa no confirma que Render esté ejecutando este commit.

## 14.4 Operación

El healthcheck devuelve estado, latencia, store, contadores y preparación Google sin mostrar secretos. El logging produce JSON con request ID y redacción. Hay scripts de migración JSON→PostgreSQL, restauración y automatización CRM. La restauración de una base productiva no fue ensayada.

# 15. Verificación y calidad

## 15.1 Resultados positivos

La validación sintáctica descubrió y comprobó 260 módulos JavaScript sin errores. La suite Studio pasó core, nuevos módulos, estado, layouts, medios, imágenes, publicación, worker, datos, validación, renderer, arquitectura y QA visual. Los dos guards de arquitectura pasaron con un `app.js` de 163.228 bytes, un `server.mjs` de 6.472 bytes y 39 familias API registradas.

El smoke levantó un servidor temporal, protegió rutas admin, creó y deduplicó un lead con consentimiento, registró eventos, creó una reserva válida, generó recordatorio y timeline, ejercitó scoring, pérdida, merge, pipeline, reportes y preparación Google. Su salida final fue:

```text
Pilot smoke test passed.
Health: ok; contacts: 6; bookings: 1; events: 1.
Verified: admin auth, lead consent, booking consent, status changes,
monthly reports and Google readiness.
```

El repositorio contiene 87 scripts, 91 archivos `test-*.mjs` y unas 2.754 apariciones de `assert`. En la comprobación final pasaron además Descubre tu zona/Modo Ruta y las suites CRM 2 de fundamento y RBAC, comunicaciones, comercio e inteligencia, cubriendo modelo, API y navegador. Las entregas CRM 2 conservan el resultado de las fases restantes —cuentas, oportunidades, tareas, consentimiento, Cliente 360, campañas, quote-to-cash, recursos, reputación y crecimiento—. El número de pruebas describe amplitud, no cobertura formal de líneas.

## 15.2 Guard de arquitectura

En el corte visual del 16 de julio, el guard ya había detenido correctamente la suite con:

```text
src/app.js must remain below 180 KB; current size is 253766
```

Antes de esta extracción el archivo había crecido ligeramente hasta 253.865 bytes. La solución aplicada fue extraer responsabilidades, no elevar el límite. El resultado final es:

```text
Studio architecture guard passed.
Studio app bytes: 163228.
Server architecture guard passed.
Server bytes: 6472; API routes: 39.
```

El guard del Studio comprueba también que `workspace.html` cargue los módulos requeridos y que `app.js` no vuelva a absorber sus fábricas. El guard del servidor valida manifiesto, unicidad, tamaño y separación de imports.

## 15.3 Navegador E2E

`test:studio-browser` abre un navegador CDP y pretende recorrer edición directa, layouts, historial, entrega y descargas. En el intento final del 23 de julio el target volvió a cerrarse mientras esperaba `document.documentElement.dataset.studioReady`. Por ello no se afirma que esa secuencia haya pasado.

Un capturador más corto sí cargó el Studio, esperó el mismo indicador, cambió a viewport móvil y generó figuras válidas. La diferencia sugiere una interacción entre el perfil de flags, recursos y estabilidad del navegador, pero la causa exacta no se determina en esta memoria.

## 15.4 Ausencias de calidad

No se encontró:

- informe de cobertura de líneas/ramas;
- prueba de carga o concurrencia;
- pentest independiente;
- prueba de restauración de PostgreSQL real;
- matriz completa WCAG con lector de pantalla;
- evaluación UX documentada con participantes;
- monitorización productiva con métricas y alertas externas.

Estas ausencias son líneas de mejora, no pruebas de que el sistema falle en todos esos ámbitos.

# 16. Evolución y contradicciones documentales

## 16.1 De JSON a persistencia dual

La memoria anterior describía JSON como base del MVP y PostgreSQL como futuro. El estado actual conserva JSON y añade un driver PostgreSQL, migrador y configuración Render. La evolución es observable en código; la fecha o motivación exacta requiere confirmación del autor.

## 16.2 De Google ejemplo a módulo principal

Los planes antiguos situaban OAuth Google y Business Profile como trabajo posterior. El backend actual contiene el flujo completo de autorización, cifrado y rutas operativas. La disponibilidad real de cuentas y APIs continúa sin verificar.

## 16.3 Crecimiento de pruebas

Una versión histórica proponía “añadir pruebas automatizadas”. El repositorio actual expone 87 scripts, 91 archivos `test-*.mjs` y aproximadamente 2.754 apariciones de `assert`. El número muestra evolución, pero no equivale a cobertura formal.

## 16.4 CRM 2 y separación de superficies

Entre el corte visual del 16 de julio y este documento se incorporaron cuentas, oportunidades, tareas, consentimiento, Cliente 360, omnicanalidad, campañas, quote-to-cash, recursos, reputación, fidelización, inteligencia y seis roles. También se separaron la landing, el workspace, Control DLS y el portal cliente. Las figuras anteriores siguen siendo válidas para los flujos que muestran, pero no deben utilizarse como inventario completo de la versión actual.

## 16.5 Regresión y corrección de modularidad

`docs/AHORA.md` registró una bajada histórica de `src/app.js` a unos 156 KB. El crecimiento funcional posterior lo llevó a 253.865 bytes y el guard detectó la regresión. Este trabajo extrae nueve responsabilidades, devuelve el archivo a 163.228 bytes y añade un guard equivalente al servidor. La contradicción queda resuelta por medición y por un cambio estructural verificable.

## 16.6 Supabase

`docs/CIBERSEGURIDAD.md` enumera Supabase DB/Auth como stack, mientras que el runtime principal usa PostgreSQL directo o JSON. Existen SQL y migraciones preparatorias —incluidas piezas de zona—, pero no un SDK de Supabase conectado ni Auth/RLS verificables como mecanismo principal. La memoria lo clasifica como infraestructura opcional/preparatoria, no como dependencia operativa demostrada.

# 17. Limitaciones y deuda técnica

## 17.1 Deuda prioritaria

1. **Dividir `src/business/dashboard.js`.** Sus 522.425 bytes y 10.873 líneas concentran dominios, renderizado y coordinación del portal.
2. **Estabilizar el E2E de navegador.** Capturar logs/crash dumps, separar escenarios y ejecutarlo en CI con navegador fijado.
3. **Limpiar el índice Git.** Retirar los 1.401 archivos de `node_modules` rastreados mediante un cambio controlado y verificar reproducibilidad con `npm ci`.
4. **Actualizar evidencia visual.** Generar un segundo juego de capturas para landing, Control DLS, portal cliente, CRM 2 y Descubre tu zona.
5. **Endurecer sesión/CSP.** Evaluar cookie HttpOnly/SameSite y reducir `'unsafe-inline'` cuando la arquitectura lo permita.
6. **Rate limit distribuido.** Sustituir memoria local si se usan réplicas.
7. **Reforzar integridad PostgreSQL.** Añadir migraciones incrementales, restricciones e índices para relaciones críticas.
8. **Mantener contratos de arquitectura.** Exigir registro de rutas, módulo dueño y prueba al añadir dominios.

## 17.2 Limitaciones de producto

- Google, canales, pagos, IA y publicación remota necesitan credenciales, consentimiento o aprobación externa para operar en vivo.
- No existe prueba de uso productivo o impacto comercial.
- La capa PostgreSQL no normaliza todas las relaciones.
- Parte de la UI depende de CDN/servicios externos.
- No hay evidencia de un despliegue público correspondiente exactamente a este corte.
- La amplitud funcional del dashboard puede afectar rendimiento y mantenibilidad hasta completar su partición.

## 17.3 Limitaciones de esta memoria

La auditoría no accedió a proveedores ni datos reales; no realizó pruebas jurídicas, de carga o pentest; y no puede reconstruir motivaciones históricas no registradas. El documento corresponde a un estado de trabajo basado en `9eba886` más la refactorización todavía no etiquetada como release. Las capturas son del 16 de julio, por lo que una defensa que muestre la interfaz actual debe acompañarlas con evidencia visual renovada.

# 18. Trabajo futuro propuesto

El trabajo futuro debe priorizar evidencia y riesgo:

## 18.1 Corto plazo

- hacer reproducible `test:studio-browser` en CI;
- extraer el dashboard por dominios —CRM, agenda, comunicaciones, crecimiento e integraciones— con fábricas y tests;
- renovar capturas, inventario visual y prueba de PDF;
- verificar secrets, licencias y datos antes de publicar el repositorio;
- limpiar dependencias versionadas.

## 18.2 Medio plazo

- añadir migraciones incrementales y restricciones relacionales;
- usar rate limit compartido y observabilidad externa;
- crear pruebas de restauración, carga y fallo de proveedores;
- reducir inline script/style y endurecer CSP;
- verificar adaptadores de canales y pagos en sandbox de proveedor y documentar reintentos/conciliación.

## 18.3 Validación externa

- ejecutar un piloto con consentimiento y objetivos medibles;
- definir métricas antes de observar resultados;
- realizar evaluación de accesibilidad con usuarios y tecnologías asistivas;
- documentar privacidad y conservación con asesoramiento adecuado;
- validar Google/Stripe/Cloudflare en entornos de prueba de proveedor;
- registrar commit, configuración no sensible y fecha de cada despliegue.

# 19. Conclusiones

DLS muestra una evolución desde un generador web hacia una suite operativa para negocios locales. La arquitectura actual combina landing y frontend multipágina, módulos Studio compartidos, un backend Node nativo y persistencia dual. La continuidad entre adquisición, producción, web, captación, CRM 2, reservas, comercio e inteligencia está respaldada por rutas, modelos y pruebas. El Studio y la web final comparten renderer, y el backend organiza 39 familias mediante manejadores independientes y un router declarativo.

La refactorización corrige la regresión de `src/app.js` y reduce el composition root del servidor sin cambiar la estrategia tecnológica. La evaluación también impone límites claros: `src/business/dashboard.js` concentra todavía demasiadas responsabilidades; la prueba E2E larga no es estable; la configuración no demuestra un despliegue real; y los proveedores externos solo se han validado mediante contratos, simulaciones o modo desarrollo.

La principal aportación técnica observable es la integración de producción y operación en un sistema portable, capaz de funcionar localmente con JSON y migrar a PostgreSQL. La siguiente etapa no consiste en añadir alcance indiscriminadamente, sino en consolidar el dashboard, seguridad de sesión, integridad de datos, observabilidad, evidencia visual y validación externa. Esta conclusión se limita a la evidencia disponible y no atribuye resultados comerciales o de usuarios que el repositorio no contiene.

# 20. Fuentes técnicas del repositorio

## 20.1 Código y configuración primaria

1. `package.json`. Manifiesto, runtime, dependencias y scripts.
2. `index.html`, `workspace.html` y `src/app.js`. Landing, entrada y composición Studio.
3. `src/studio/`. Modelos, controladores, utilidades, estado, layouts, medios, validación, renderer y entrega.
4. `src/business/` y `src/radar/`. Vistas operativas y prospección.
5. `server/server.mjs`, `server/http/api-router.mjs` y `server/api/`. Composición, manifiesto y contratos HTTP.
6. `server/lib/`. Persistencia, autenticación, seguridad, logging y lógica de dominio.
7. `server/scripts/`. Pruebas, smoke, migración, validación y operaciones.
8. `Dockerfile`, `render.yaml`, `cloudflare/` y `.github/`. Despliegue y automatización.
9. `data/*.example.json`. Forma de datos de ejemplo.
10. `pages/admin-dashboard.html`, `pages/client-dashboard.html` y `pages/zone-playground.html`. Superficies operativas actuales.

## 20.2 Documentación histórica contrastada

1. `docs/AHORA.md`.
2. `docs/CIBERSEGURIDAD.md`.
3. `docs/referencia/LOCAL_LIFT_STUDIO_MEMORIA_TFG.md`.
4. `docs/operaciones/DEPLOYMENT.md`.
5. `docs/operaciones/SUPABASE_RLS_FASE_2.md`.
6. `docs/referencia/GOOGLE_INTEGRATION_PLAN.md`.
7. `docs/activo/CRM_2_ENTREGA_FINAL.md`.
8. `docs/activo/ARQUITECTURA_MODULAR_V3.md`.

Estas fuentes históricas no prevalecen sobre el corte actual. Las contradicciones están registradas en `anexos/contradicciones_documentacion.md`.

# Anexo A. Ficha de reproducibilidad

| Elemento | Valor auditado |
|---|---|
| Base Git | `9eba88695ae39af83ab40a147f38ee88dc15a77a` + refactorización modular de trabajo |
| Fecha | 23/07/2026 |
| Node local | `v24.13.1` |
| npm local | `11.8.0` |
| Runtime declarado | Node `>=22.19` |
| Store de capturas | JSON aislado |
| Negocio | Luma Café — entorno de prueba |
| Datos reales | No utilizados |
| Servicios externos productivos | No consultados |
| Capturas | 16 históricas del 16/07/2026 |
| Sintaxis | Superada, 260 módulos |
| Smoke | Superado |
| QA visual | Superada |
| Guard Studio | Superado, 163.228 bytes |
| Guard servidor | Superado, 6.472 bytes y 39 familias API |
| E2E navegador largo | Fallido por cierre del target |

# Anexo B. Metadatos pendientes del documento

- **Título oficial:** [pendiente de confirmar].
- **Autor:** [pendiente de confirmar].
- **Tutor/a:** [pendiente de confirmar].
- **Titulación:** [pendiente de confirmar].
- **Centro/universidad:** [pendiente de confirmar].
- **Curso y convocatoria:** [pendiente de confirmar].
- **Norma de referencias:** [pendiente de confirmar].

# Anexo C. Declaración de tratamiento de evidencias

Las capturas se obtuvieron automáticamente a partir del runtime del repositorio. El fixture y el capturador quedan incluidos para reproducibilidad. No se alteró el código para aparentar las funciones mostradas ni se sustituyeron flujos imposibles por imágenes generadas. Los servicios que requerían credenciales se documentaron con su estado no configurado o se trasladaron al listado de capturas no obtenidas. Las funciones incorporadas después del corte visual se describen con referencia a código y pruebas, no como si aparecieran en esas figuras.

La revisión final del PDF se documenta mediante las imágenes de `revision_pdf/` y su informe. Cualquier cambio posterior del código invalida la correspondencia exacta entre esta memoria y el sistema, por lo que debe registrarse un nuevo commit y repetir las comprobaciones relevantes.
