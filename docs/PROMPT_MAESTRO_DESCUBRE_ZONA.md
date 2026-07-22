# PROMPT MAESTRO — Módulo "Descubre tu Zona"
### Documento de implementación técnica para asistente de codificación IA (Codex)

---

## 0. CONTEXTO DEL PROYECTO

Este módulo se integra en **DLS Studio**, plataforma SaaS que genera y gestiona webs para negocios locales, con backend Supabase, radar de negocios (OSM + Google Places) y CRM propio.

El objetivo de este documento es especificar de forma **cerrada y no ambigua** una nueva funcionalidad: un apartado premium en cada web generada llamado **"Descubre tu zona"**, activable/desactivable por el propio negocio cliente, que muestra recomendaciones de lugares de interés y otros negocios DLS cercanos, con estética y calidad de contenido de nivel editorial/revista de viajes — no un simple listado.

---

## 1. REGLAS ESTRICTAS DE IMPLEMENTACIÓN (LEER ANTES DE EMPEZAR)

**El asistente de codificación DEBE seguir estas reglas sin excepción:**

1. **Prohibido improvisar arquitectura de datos.** El esquema de Supabase especificado en la Sección 3 es cerrado. No añadir, renombrar ni eliminar columnas o tablas sin que se indique explícitamente en este documento.
2. **Prohibido improvisar geometría o composición visual.** El layout, espaciados, jerarquía tipográfica y estructura de la Sección 6 son vinculantes. No sustituir por soluciones "más simples" o plantillas genéricas de UI.
3. **Prohibido usar librerías de mapas no especificadas.** Usar exclusivamente la librería indicada en la Sección 6.4. No sustituir por Google Maps embed genérico ni por soluciones de terceros no auditadas.
4. **Prohibido usar modelos de lenguaje para las descripciones del módulo.** Aplicar exclusivamente el flujo documental de Wikipedia/Wikidata de la Sección 5.
5. **Implementación por fases secuenciales (Sección 8).** No saltar de fase sin completar y validar la anterior.
6. **Ante cualquier ambigüedad no cubierta explícitamente aquí, el asistente debe detenerse y preguntar, no asumir.**

---

## 2. OBJETIVO FUNCIONAL

Cada negocio cliente de DLS Studio tiene, en el panel de administración de su web, un **toggle** ("Activar Descubre tu zona"). Si lo activa:

- Aparece en su web pública un bloque al final de la página (footer superior, antes del footer legal) con un botón/CTA: **"Descubre esta zona"**.
- Al pulsar el botón (o icono, ver Sección 6), se abre una **experiencia a pantalla completa** (modal fullscreen o ruta dedicada `/descubre`, ver Sección 6.1) con:
  - Mapa profesional interactivo centrado en la ubicación del negocio.
  - Tarjetas de recomendación de alta calidad visual: monumentos, puntos de interés turístico/cultural, y otros negocios que usan DLS Studio cerca de esa ubicación.
  - Contenido documental obtenido automáticamente de Wikipedia/Wikidata según la Sección 5, sin modelos de lenguaje.

**Principio de negocio clave:** esto NO es un directorio. Es una pieza de marketing premium que:
- Da valor real al visitante final (recomendaciones útiles y bonitas).
- Retiene al cliente DLS (ve tráfico cruzado real, ver Sección 7).
- Convierte cada web en un nodo de una red que crece con cada negocio nuevo que se une (efecto red).

---

## 3. ESQUEMA DE DATOS (SUPABASE) — CERRADO

```sql
-- Tabla de puntos de interés no-DLS (monumentos, lugares turísticos, naturaleza, cultura)
CREATE TABLE zone_points_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'monumento', 'naturaleza', 'cultura', 'mirador', 'plaza', 'playa', 'parque', 'otro'
  description_short TEXT, -- derivado del extracto documental, ~140 caracteres
  description_long TEXT, -- extracto Wikipedia/Wikidata, ~90 palabras
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  image_url TEXT, -- fuente: Unsplash/Pexels/Pixabay vía módulo de imágenes ya existente, o Wikimedia Commons para monumentos
  source TEXT, -- 'osm', 'wikidata', 'wikipedia', 'manual'
  external_ref TEXT, -- id de OSM o Wikidata si aplica
  verified BOOLEAN DEFAULT FALSE, -- true = revisado manualmente, prioridad de aparición
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conexiones entre negocios DLS (grafo de afinidad, ya conceptualizado previamente)
CREATE TABLE business_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_a_id UUID NOT NULL REFERENCES businesses(id),
  business_b_id UUID NOT NULL REFERENCES businesses(id),
  connection_type TEXT NOT NULL, -- 'complementario', 'competidor', 'neutro'
  affinity_score NUMERIC(5,2) NOT NULL DEFAULT 0, -- 0-100, ver cálculo Sección 4.2
  distance_meters INTEGER NOT NULL,
  clicks_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_a_id, business_b_id)
);

-- Configuración del módulo por negocio
CREATE TABLE zone_discovery_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses(id),
  is_enabled BOOLEAN DEFAULT FALSE,
  excluded_business_ids UUID[] DEFAULT '{}', -- opt-out manual de conexiones concretas (ver regla ética Sección 9)
  excluded_poi_ids UUID[] DEFAULT '{}',
  radius_meters INTEGER DEFAULT 1500, -- radio de búsqueda configurable, default 1.5km
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tracking de interacción (para dashboard de retención, Sección 7)
CREATE TABLE zone_discovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_business_id UUID NOT NULL REFERENCES businesses(id), -- desde qué web se abrió
  event_type TEXT NOT NULL, -- 'opened', 'card_clicked', 'directions_clicked'
  target_business_id UUID REFERENCES businesses(id), -- si el clic fue a otro negocio DLS
  target_poi_id UUID REFERENCES zone_points_of_interest(id), -- si el clic fue a un POI
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Políticas RLS: cada negocio solo puede leer/escribir su propia fila en zone_discovery_settings.
-- zone_points_of_interest y business_connections son de lectura pública (anon), escritura solo backend/service role.
```

---

## 4. LÓGICA DE SELECCIÓN DE RECOMENDACIONES

### 4.1 Regla de mezcla (crítico para el "arranque en frío")

Como al principio habrá pocos negocios DLS en cada zona, el algoritmo de selección **nunca depende solo de negocios DLS**. Cada apertura del módulo debe mostrar una mezcla, calculada así:

```
Total de tarjetas a mostrar: 6 (fijo, ver Sección 6.3)

Paso 1: Buscar negocios DLS activos (is_enabled = true) dentro del radio,
        con connection_type != 'competidor' respecto al negocio anfitrión,
        ordenados por affinity_score descendente.
        → Máximo 3 tarjetas de este tipo (nunca más, aunque haya disponibilidad,
          para no saturar de "publicidad" la experiencia).

Paso 2: Rellenar el resto (mínimo 3, hasta completar 6) con
        zone_points_of_interest dentro del radio, priorizando:
          1º verified = true
          2º categorías variadas (no repetir categoría si hay alternativa)
          3º cercanía

Si no hay suficientes negocios DLS ni POIs para llegar a 6,
mostrar los disponibles (mínimo aceptable: 3 tarjetas). 
Si hay menos de 3 en total, el botón "Descubre esta zona" NO se muestra
en la web pública (evitar experiencia pobre).
```

### 4.2 Cálculo de `affinity_score` (negocio-a-negocio)

```
affinity_score = (peso_categoria * 0.5) + (peso_distancia * 0.3) + (peso_interaccion * 0.2)

peso_categoria: tabla de afinidad categoría-a-categoría (ver Anexo A), 0-100
peso_distancia: 100 - (distancia_metros / radius_meters * 100), mínimo 0
peso_interaccion: normalizado desde clicks_generated histórico (0-100),
                  0 si aún no hay datos (arranque en frío)

connection_type se asigna automáticamente:
  - 'competidor' si misma categoría exacta (ej. dos restaurantes) → excluido siempre de la selección
  - 'complementario' si está en la tabla de afinidad positiva (Anexo A)
  - 'neutro' en cualquier otro caso → elegible pero con score bajo
```

### 4.3 Selección de POIs

Los POIs se cargan una única vez por zona geográfica (no en cada request) mediante:
- Overpass API (OSM) para monumentos, naturaleza, plazas, miradores (tags `historic=*`, `tourism=*`, `natural=*`, `leisure=park`).
- Wikidata/Wikipedia para descripciones enriquecidas cuando el POI tiene entidad asociada (mejora la calidad del contenido editorial).
- Se cachean en `zone_points_of_interest` con un job periódico (no en tiempo real de usuario).

---

## 5. OBTENCIÓN AUTOMÁTICA DE CONTENIDO DOCUMENTAL (SIN IA)

No se realiza ninguna llamada a Anthropic ni a ningún otro modelo de lenguaje.

- `description_long`: extracto directo del resumen de Wikipedia mediante `/page/summary/{title}`. Si no existe página asociada pero el POI tiene entidad Wikidata, usar su campo `description`/`summary`. Si supera aproximadamente 90 palabras, cortar por frase completa.
- `description_short`: primeros ~140 caracteres del mismo extracto, cortando en la última palabra completa disponible.
- `source`: guardar el origen real (`wikipedia` o `wikidata`).
- `external_ref`: guardar el ID de Wikidata o el título de Wikipedia utilizado.
- Si no existe entidad documental, mantener `description_long` en `NULL`. La tarjeta muestra únicamente nombre, categoría y distancia, sin bloque expandible.
- Cuando el texto proceda de Wikipedia, mostrar atribución visible **“Fuente: Wikipedia”** enlazada a la página original por la licencia CC BY-SA.

---

## 6. ESPECIFICACIÓN VISUAL (CERRADA — NO IMPROVISAR)

### 6.1 Punto de entrada en la web del negocio

- Ubicación: bloque de ancho completo, justo antes del footer legal.
- Fondo diferenciado del resto de la web (color de acento de la marca del negocio, con overlay oscuro si hay imagen de fondo del mapa difuminado).
- Título del bloque: **"Descubre {nombre_zona_o_barrio}"** (no genérico "descubre tu zona" cara al usuario final).
- CTA: botón grande, icono de brújula o pin de mapa + texto "Explorar la zona".
- Al pulsar: abre experiencia en modal fullscreen (preferido, mantiene contexto SEO de la página) con transición suave (fade + scale, 300ms).

### 6.2 Estructura de la experiencia fullscreen

```
┌─────────────────────────────────────────────┐
│  [X cerrar]        Descubre {zona}           │
├─────────────────┬─────────────────────────────┤
│                 │                             │
│                 │   Mapa interactivo          │
│   Panel de      │   (60% del ancho en desktop,│
│   tarjetas      │    100% arriba en mobile,   │
│   scrolleable   │    con tarjetas debajo)     │
│   (40% ancho)   │                             │
│                 │   - Marcador del negocio    │
│                 │     anfitrión (icono propio,│
│                 │     distinguible)           │
│                 │   - Marcadores de           │
│                 │     recomendaciones         │
│                 │     (icono según categoría) │
│                 │                             │
└─────────────────┴─────────────────────────────┘
```

En mobile: mapa arriba (40% altura viewport, sticky), tarjetas abajo en scroll vertical a pantalla completa.

### 6.3 Diseño de las tarjetas de recomendación

Cada tarjeta (6 en total, ver Sección 4.1):

- Imagen de cabecera, ratio 16:9, con lazy loading y blur-up placeholder.
- Badge superpuesto esquina superior izquierda indicando tipo: "Monumento", "Naturaleza", "Recomendado" (para negocios DLS, nunca decir "anuncio" o "patrocinado" — usar "Recomendado por la zona").
- Título (`description_short` como subtítulo, no como título — el título es el nombre real del lugar).
- Descripción larga visible solo al expandir la tarjeta (clic) o en hover en desktop.
- Distancia desde el negocio anfitrión, calculada y mostrada en formato humano ("a 4 min andando", no "320m" — convertir a tiempo estimado a pie, velocidad media 5km/h).
- Al hacer clic en la tarjeta: el mapa hace `flyTo` (animación de vuelo) al marcador correspondiente y lo resalta.
- Tipografía: usar la tipografía de marca ya definida en el sistema de diseño de DLS Studio (no introducir una nueva familia tipográfica para este módulo).

### 6.4 Mapa — librería y estilo

- Librería: **Leaflet** (ya usada en el proyecto del TFG/radar, mantener consistencia técnica y evitar coste de licencias de Mapbox/Google Maps a escala).
- Tiles: usar un proveedor de tiles con estética "editorial" (estilo claro, minimalista, poco saturado) — ejemplo: CartoDB Positron o Stadia Maps Alidade Smooth. **No usar el estilo por defecto de OpenStreetMap** (demasiado saturado visualmente para un componente premium).
- Marcadores custom (SVG propio, no el pin por defecto de Leaflet): icono distinto para negocio anfitrión, negocios DLS recomendados, y cada categoría de POI (monumento, naturaleza, mirador, etc.).
- Clustering: si hay más de 8 marcadores en el radio total (aunque solo se muestren 6 tarjetas, el mapa puede mostrar contexto adicional atenuado), usar `Leaflet.markercluster`.

### 6.5 Paleta y estética general

- Fondo del modal: blanco roto / crema (no blanco puro, para diferenciarlo del resto de la web y dar sensación editorial).
- Espaciados generosos (seguir el principio "menos es más" — esto debe sentirse como una revista, no como un directorio de páginas amarillas).
- Ninguna tarjeta debe llevar más de una acción visible por defecto (evitar sobrecarga de botones).
- Animaciones sutiles de entrada (stagger fade-in de tarjetas al abrir el modal, 60-80ms de delay entre cada una).

---

## 7. DASHBOARD DE RETENCIÓN (conectar con CRM existente)

En el panel de administración del negocio cliente, añadir sección "Tu zona":
- Nº de aperturas del módulo esta semana/mes (`zone_discovery_events` tipo `opened`).
- Nº de clics hacia su propio negocio generados desde webs de otros negocios DLS vecinos (si es él quien aparece recomendado en otra web).
- Mensaje automático tipo: *"Esta semana recibiste {N} visitas potenciales gracias a negocios vecinos en DLS Studio."*
- Este dato se usa como justificación de valor de la cuota mensual — debe ser visible sin necesidad de que el cliente lo pida.

---

## 8. FASES DE IMPLEMENTACIÓN (SECUENCIALES — NO SALTAR ORDEN)

**Fase 1 — Backend y datos**
1. Crear las 4 tablas de la Sección 3 con políticas RLS.
2. Implementar job de carga de POIs vía Overpass API por zona (ejecutar bajo demanda al activar el módulo por primera vez en una zona nueva, luego cachear).
3. Implementar función de cálculo de `affinity_score` (Sección 4.2) y job que recalcula conexiones al crear/actualizar un negocio.

**Fase 2 — Contenido documental sin IA**
4. Resolver entidades OSM → Wikidata/Wikipedia y obtener sus resúmenes en batch.
5. Derivar y almacenar `description_short` / `description_long`, origen y referencia; dejar descripciones nulas cuando no exista fuente documental.

**Fase 3 — API de selección**
6. Endpoint que, dado un `business_id`, devuelve las 6 recomendaciones siguiendo la lógica de la Sección 4.1.
7. Endpoint de tracking de eventos (Sección 3, `zone_discovery_events`).

**Fase 4 — Frontend**
8. Toggle en panel de administración (`zone_discovery_settings`).
9. Bloque CTA en la web pública (Sección 6.1).
10. Modal fullscreen con mapa Leaflet + tarjetas (Secciones 6.2 a 6.5).
11. Integrar tracking de clics.

**Fase 5 — Dashboard de retención**
12. Sección "Tu zona" en el panel de administración (Sección 7).

**No avanzar a la fase siguiente sin validar que la anterior funciona con datos reales de al menos una zona de prueba.**

---

## 9. REGLA ÉTICA / DE CONTROL DEL CLIENTE (obligatoria)

El negocio anfitrión debe poder, desde su panel:
- Desactivar el módulo completo en cualquier momento (`is_enabled = false`).
- Excluir manualmente negocios concretos de aparecer en su web (`excluded_business_ids`), sin necesidad de justificar por qué.
- Excluir POIs concretos si no quiere asociar su marca a un lugar determinado (`excluded_poi_ids`).

Nunca mostrar recomendaciones sin que el negocio haya activado explícitamente el módulo (opt-in, no opt-out por defecto).

---

## ANEXO A — Tabla de afinidad de categorías (punto de partida, ampliable con datos reales)

| Categoría A | Categoría B | Afinidad |
|---|---|---|
| Restaurante | Heladería | Alta |
| Restaurante | Bar de copas | Media |
| Restaurante | Restaurante | Competidor (excluido) |
| Peluquería | Centro de estética | Alta |
| Peluquería | Tienda de ropa | Media |
| Hotel/Alojamiento | Restaurante | Alta |
| Hotel/Alojamiento | Monumento/turismo | Alta |
| Cafetería | Librería | Alta |
| Tienda de souvenirs | Monumento/turismo | Alta |
| Bodega/Vinoteca | Restaurante | Alta |

*(Esta tabla debe ampliarse durante la Fase 1 con las categorías reales presentes en la base de negocios de DLS Studio.)*
