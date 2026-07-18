# PROMPT MAESTRO — Landing Page Corporativa DLS Studio

## ROL Y CONTEXTO

Eres el desarrollador frontend encargado de sustituir la pantalla de entrada actual de DLS Studio (logo → botón "Start" → selección developer/cliente) por una **landing page corporativa completa**, a nivel de diseño de Apple, Linear, Stripe o Vercel. Esta landing es la nueva puerta de entrada pública de la plataforma. Los accesos actuales (developer / cliente) NO desaparecen: pasan a ser dos CTAs dentro de esta nueva página, no la pantalla inicial.

**No improvises arquitectura, stack de animación ni geometría visual fuera de lo que se especifica en este documento.** Si algo no está definido, pregunta antes de decidir por tu cuenta.

---

## 0. STACK OBLIGATORIO

- **Framework:** el que ya usa el proyecto DLS Studio actualmente (detéctalo del repo, no lo cambies ni lo actualices de versión mayor).
- **Estilos:** Tailwind CSS con tokens de diseño centralizados (ver sección 2).
- **Animaciones de scroll:** GSAP + plugin ScrollTrigger.
- **Smooth scroll:** Lenis, sincronizado con el ticker de GSAP (no uses el `raf` propio de Lenis por separado; usa `gsap.ticker.add()` + `lenis.raf(time * 1000)` + `gsap.ticker.lagSmoothing(0)`).
- **Prohibido:** Locomotive Scroll, ScrollMagic, AOS.js, librerías de animación abandonadas o de peso excesivo.
- **Permitido en la Fase 6 (ver sección 7):** Three.js/WebGL para el fondo del hero y GSAP `SplitText` para el titular. Todo lo de la Fase 6 debe tener fallback ligero automático (ver sección 7), no es opcional.
- Todas las animaciones deben usar `transform` y `opacity` exclusivamente (nunca `top/left/width/height`) para ir a 60fps y no penalizar el INP.
- Respeta `prefers-reduced-motion`: si el usuario lo tiene activado, todas las animaciones de scroll se desactivan y el contenido aparece directamente, sin transición.

---

## 1. ESTRUCTURA DE LA PÁGINA (orden fijo, no reordenar)

1. **Header fijo** — logo DLS Studio a la izquierda, navegación con anclas a las secciones (Servicios, Cómo funciona, CRM, Hosting, Precios/Contacto), y a la derecha dos botones: "Acceder como desarrollador" (secundario/outline) y "Acceder como cliente" (primario/relleno). El header cambia de fondo (transparente → sólido con blur) al hacer scroll.
2. **Hero** — titular de máximo 8-10 palabras que resuma la propuesta de valor (generamos, alojamos y gestionamos webs para negocios locales, con CRM incluido). Subtítulo de una frase. CTA principal ("Empieza ahora" o similar) + CTA secundario ("Ver cómo funciona"). Animación de entrada tipo reveal por líneas de texto (stagger con GSAP), no fade genérico.
3. **Prueba de fuerza / demostración** — sección de scroll narrativo (scroll-driven) que va mostrando, en bloques que se activan según el progreso del scroll: (a) generación automática de la web, (b) el hosting, (c) el radar de negocios (OpenStreetMap + Google Places), (d) el CRM con pipeline Kanban, (e) contenido generado con IA. Cada bloque debe entrar con su propia animación (pin de sección + reveal), no una lista estática.
4. **Bloque de servicios** — grid de 4-6 tarjetas (una por capacidad: generación web, hosting, CRM/leads, radar de negocios, contenido IA, exportación HTML). Hover con microinteracción sutil (elevación + sombra + escala 1.02, nunca más).
5. **Cómo funciona** — 3-4 pasos numerados en timeline horizontal o vertical con línea que se "dibuja" a medida que se hace scroll (stroke-dashoffset animado con ScrollTrigger).
6. **Social proof / cifras** — contadores animados (number ticker) al entrar en viewport: nº de webs generadas, tiempo medio de puesta en marcha, etc. (usa cifras de ejemplo marcadas como `TODO: sustituir por dato real`).
7. **CTA final** — repite los dos accesos (desarrollador / cliente) a pantalla completa, con el mismo peso visual que en el header.
8. **Footer** — estándar, minimalista, coherente con el resto.

---

## 2. SISTEMA DE DISEÑO

- Define una paleta de 2-3 colores base + 1 acento, en variables CSS/Tailwind config (no colores sueltos en el código).
- Tipografía: una familia sans-serif para todo, con 2 pesos máximo (regular + semibold/bold) usados de forma consistente. Escala tipográfica clara (hero grande, secciones medianas, cuerpo legible).
- Espaciado consistente en base 8px.
- Bordes redondeados y sombras coherentes en todos los componentes (define el valor una vez, reutilízalo).
- Modo oscuro no es obligatorio en esta fase salvo que ya exista en el proyecto; si existe, la landing debe respetarlo.

---

## 3. REGLAS DE ANIMACIÓN (no negociables)

- Cada sección tiene **una sola** idea de animación clara. Nada de mezclar 4 efectos distintos en la misma sección.
- Los `ScrollTrigger` deben usar `start`/`end` explícitos y `markers: false` en producción.
- Los timelines deben limpiarse (`ScrollTrigger.kill()`) al desmontar el componente si el framework es SPA con routing.
- Nada de animaciones que bloqueen la interacción del usuario más de 300ms.
- Todo elemento animado debe tener un estado final accesible aunque JS falle (contenido visible por defecto, animación como mejora progresiva).

---

## 4. FASES DE IMPLEMENTACIÓN (ejecuta en este orden, una fase por commit/entrega)

**Fase 1 — Estructura y contenido estático**
Maqueta las 8 secciones en HTML/JSX semántico, sin animaciones, con el sistema de diseño aplicado. Contenido de placeholder marcado con `TODO`.

**Fase 2 — Smooth scroll + setup de GSAP**
Integra Lenis + GSAP ScrollTrigger según la sección 0. Verifica que el scroll nativo, los anchors del header y la accesibilidad (tab navigation) siguen funcionando.

**Fase 3 — Animaciones sección por sección**
Implementa las animaciones descritas en la sección 1, en el orden ahí listado. No pases a la siguiente sección sin confirmar que la anterior no tiene jank (usa el DevTools Performance panel si puedes).

**Fase 4 — Routing de los dos accesos**
Conecta los botones "Acceder como desarrollador" y "Acceder como cliente" con los flujos ya existentes en la plataforma (los que hoy cuelgan del botón "Start"). No modifiques la lógica interna de esos flujos, solo el punto de entrada.

**Fase 5 — Responsive y performance**
Adapta a mobile (las animaciones de scroll narrativo en mobile deben simplificarse: menos pineo de secciones, más reveals simples). Audita con Lighthouse: objetivo LCP < 2.5s, CLS < 0.1, INP < 200ms.

**Fase 6 — Nivel "máxima demostración de fuerza"**
Implementa todo lo descrito en la sección 7 (shader del hero, secuencia de scroll scrubbing, microinteracciones de marca, scroll horizontal). Empieza siempre por construir el fallback ligero de cada pieza y verifica que funciona correctamente ANTES de construir la versión completa; así, si algo no llega a los números de rendimiento, ya tienes la red de seguridad lista. Mide Lighthouse en mobile después de cada pieza añadida, no solo al final.

---

## 7. NIVEL "MÁXIMA DEMOSTRACIÓN DE FUERZA" (obligatorio en esta versión)

Esta sección define el techo de calidad que quiero. No es opcional ni "si hay tiempo": es el objetivo del proyecto. Cada pieza tiene su propia condición de fallback para que nunca comprometa el rendimiento.

### 7.1 Hero — fondo generativo WebGL
- Fondo del hero con Three.js: shader de gradiente animado (ruido tipo "fluid"/"aurora", nada de partículas 3D con física, que pesan más de lo que aportan). Reacciona sutilmente a la posición del ratón (parallax de 5-10px máximo).
- **Fallback obligatorio:** en mobile, gama baja (detectar `navigator.hardwareConcurrency` o usar un check de FPS en los primeros 2s) o `prefers-reduced-motion`, sustituir por un gradiente CSS animado estático. El usuario nunca debe notar que "le ha tocado la versión pobre", solo debe verse distinto y seguir siendo elegante.
- Titular animado con GSAP `SplitText`: entrada letra a letra con stagger, sobre el shader.

### 7.2 Secuencia central — "scroll scrubbing" cinematográfico (pieza estrella)
Esta es la sección que sustituye/amplía la actual "prueba de fuerza" del punto 1.3. Es la más importante de toda la página.
- Genera (o encarga generar) una secuencia de 80-120 frames tipo storyboard que muestre, como si fuera una demo grabada en vídeo: el usuario introduciendo el nombre de su negocio → la IA generando la web en vivo → el sitio publicándose → el radar de negocios detectando leads en el mapa → el pipeline Kanban del CRM moviéndose solo → el contenido IA escribiéndose en pantalla.
- Los frames se pintan en un `<canvas>` y el frame activo se calcula a partir del progreso del `ScrollTrigger` (`scrub: true`), exactamente como la técnica de Apple en sus páginas de producto.
- La sección debe quedar **pineada** (`pin: true`) mientras dura la secuencia, con textos superpuestos que van cambiando en sincronía con los hitos del scroll (no textos sueltos: cada frase debe estar ligada a un rango exacto de frames).
- Precarga los frames en formato `.webp` optimizado, con un loader de progreso mientras se cachean, y no arranques el pineo hasta que la precarga termine.
- **Fallback obligatorio:** en mobile, sustituir el canvas scrubbing por una secuencia de 4-5 reveals simples (imagen + texto), sin pineo largo ni canvas. El pineo largo en móvil se siente roto y hay que evitarlo, no reducirlo.

### 7.3 Microinteracciones "firma de marca"
- Cursor personalizado (círculo que crece sobre enlaces/tarjetas, se oculta en mobile).
- Botones magnéticos en todos los CTA principales (`elastic.out` al soltar).
- Tilt 3D sutil (máx. 6-8°) en las tarjetas de servicios, basado en posición del ratón.
- Transición de página tipo "barrido" (overlay a pantalla completa) al pulsar "Acceder como desarrollador/cliente", antes de navegar al flujo real.
- Grano/textura de ruido superpuesta al 3-4% de opacidad en las secciones de fondo oscuro, para evitar planitud.

### 7.4 Timeline "cómo funciona" con dibujo de trazo + horizontal scroll
- La línea de tiempo se dibuja con `stroke-dashoffset` ligado al scroll (ya estaba en el punto 1.5).
- Añade scroll horizontal dentro de la sección de servicios: el usuario sigue haciendo scroll vertical normal, pero las tarjetas se desplazan en horizontal (`xPercent` ligado al progreso del `ScrollTrigger` de esa sección), con pineo mientras dura el recorrido horizontal.

### 7.5 Condición de rendimiento (no negociable)
Todo lo anterior debe cumplir, medido con Lighthouse en modo mobile:
- LCP < 2.5s, CLS < 0.1, INP < 200ms, TBT < 300ms.
- Si alguna pieza de esta sección 7 no permite cumplir esos números, se degrada automáticamente a su fallback en vez de eliminarse. El objetivo es "brutal pero fluido", nunca "brutal pero que se cuelga".

---

## 8. QUÉ NO HACER

- No uses stock de imágenes genéricas sin avisar (usa el módulo de imágenes ya existente en el proyecto si aplica).
- No inventes copy de marketing final: usa placeholders claros y yo lo reviso.
- No mezcles la voz de marca de DLS Studio (agencia) con la del cliente final — igual que ya se corrigió en el generador de copy.
- No toques la lógica de autenticación/OAuth existente, solo el punto de entrada visual.

---

## 9. ENTREGA

Al terminar cada fase, muestra un resumen breve de qué se ha implementado y qué queda pendiente, sin generar código adicional no pedido.
