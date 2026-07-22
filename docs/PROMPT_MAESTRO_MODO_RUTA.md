# PROMPT MAESTRO — Extensión "Modo Ruta" del módulo Descubre tu Zona
### Documento adicional para asistente de codificación IA (Codex) — extiende PROMPT_MAESTRO_DESCUBRE_ZONA.md

---

## 0. CONTEXTO

Esta extensión añade capacidad de **planificación de ruta real** dentro de la experiencia "Descubre tu zona" ya especificada. El usuario, tras ver las tarjetas de recomendación, puede pedir que se le trace un itinerario a pie/coche/bici que conecte varias paradas seleccionadas, partiendo de su ubicación (o de un punto manual si no da permiso de geolocalización).

**Regla general:** esta sección es cerrada igual que el documento base. No sustituir el motor de rutas, no improvisar el algoritmo de orden de paradas, no cambiar la paleta de colores por categoría.

---

## 1. OBJETIVO FUNCIONAL

Dentro del modal fullscreen ya existente, se añade un nuevo estado de la interfaz: **"Modo Ruta"**, activable con un botón secundario ("Planear ruta") visible cuando el usuario ha marcado al menos 2 tarjetas como "añadir a mi ruta" (checkbox/icono en cada tarjeta, adicional a lo ya especificado).

Al activarlo:
1. Se determina el punto de partida (Sección 2).
2. El usuario elige perfil de transporte y modo de ruta (Sección 4).
3. Se calcula el orden óptimo de paradas y la geometría de la ruta (Sección 5).
4. Se dibuja en el mapa con iconos y colores diferenciados (Sección 6).

---

## 2. OBTENCIÓN DEL PUNTO DE PARTIDA

**Flujo obligatorio, en este orden:**

1. Al pulsar "Planear ruta", solicitar `navigator.geolocation.getCurrentPosition()` con un modal previo explicando por qué se pide (nunca pedirlo sin contexto — dispara mejor tasa de aceptación).
2. **Si el usuario deniega o el navegador no soporta geolocalización:** activar automáticamente "modo manual": el mapa muestra un mensaje ("Toca el mapa para marcar tu punto de partida") y el cursor se convierte en un pin. Un solo clic coloca un marcador arrastrable (`draggable: true` en Leaflet) que el usuario puede ajustar antes de confirmar con un botón "Confirmar punto de partida".
3. **Si el usuario concede permiso pero la precisión es baja** (`accuracy > 100` metros, campo de la Geolocation API), mostrar el punto igualmente pero con un radio de incertidumbre dibujado (círculo semitransparente) y ofrecer el botón de ajuste manual por si el usuario prefiere corregirlo.
4. El punto de partida (automático o manual) se guarda solo en estado de sesión del cliente (nunca en Supabase) — es un dato efímero, no hay necesidad ni justificación de persistirlo.

---

## 3. SELECCIÓN DE PARADAS

- Cada tarjeta (de las 6 ya existentes, Sección 4.1 del documento base) incluye un icono de "añadir a ruta" (símbolo `+` circular, esquina inferior derecha de la tarjeta).
- Mínimo 2 paradas para poder activar "Planear ruta"; máximo 6 (todas las disponibles — no tiene sentido limitarlo más ya que el propio documento base limita a 6 tarjetas por apertura).
- El orden en que el usuario las selecciona **no importa** — el algoritmo de optimización (Sección 5.2) decide el orden real de visita, no el orden de selección.

---

## 4. MODOS DE RUTA Y PERFILES DE TRANSPORTE

Dos selectores independientes, mostrados como chips/pills antes de calcular la ruta:

### 4.1 Perfil de transporte
| Perfil | Motor OSRM | Icono |
|---|---|---|
| A pie | `profile=foot` | 🚶 (icono SVG propio, no emoji en producción) |
| Bicicleta | `profile=bike` | 🚲 (ídem) |
| Coche | `profile=car` | 🚗 (ídem) |

### 4.2 Modo de ruta
- **"Más rápida"**: minimiza tiempo total de trayecto. Usa el orden de paradas resultante del algoritmo de optimización por distancia/tiempo (Sección 5.2, variante A).
- **"Panorámica"**: prioriza pasar cerca de más puntos de interés de categoría `monumento`, `mirador`, `naturaleza` (aunque no estén seleccionados como parada), y favorece calles/caminos peatonales si el perfil es "a pie". Solo disponible para perfiles "a pie" y "bicicleta" (no tiene sentido en coche). Ver Sección 5.2, variante B.

**Regla de UI:** si el usuario selecciona perfil "coche", el chip "Panorámica" se deshabilita visualmente (no se oculta, se muestra en gris con tooltip "No disponible en coche") — nunca ocultar opciones sin explicar por qué, confunde al usuario.

---

## 5. MOTOR DE RUTAS

### 5.1 Infraestructura

- Usar **OSRM (Open Source Routing Machine)** autoalojado en un contenedor Docker propio, con datos de la región relevante (España peninsular + Canarias como mínimo, ampliable) precompilados con `osrm-extract` + `osrm-contract`.
- **No usar Google Directions API ni Mapbox Directions** — motivo: coste por request a escala (esto se va a llamar potencialmente miles de veces/día si el producto escala) y para mantener consistencia con el resto del stack de mapas (Leaflet + tiles ya especificados en el documento base).
- Tres instancias/perfiles de OSRM corriendo en paralelo (foot, bike, car), o un único servidor con los tres perfiles cargados si los recursos del servidor lo permiten (`osrm-routed --algorithm mld` soporta multi-perfil desde la misma instancia en versiones recientes — verificar versión antes de asumirlo).
- Endpoint interno propio (backend DLS, no exponer OSRM directamente al frontend): `POST /api/zone/route` que recibe punto de partida + lista de paradas + perfil + modo, y devuelve la geometría ya procesada.

### 5.2 Algoritmo de orden de paradas

Con 2-6 paradas, no hace falta un solver de TSP exacto (serían decenas de miles de combinaciones como máximo, pero no merece la complejidad). Usar heurística **nearest neighbor + mejora 2-opt**:

```
1. Nearest neighbor: partiendo del punto de origen, ir siempre a la parada
   no visitada más cercana (distancia en línea recta como aproximación
   inicial, no hace falta llamar a OSRM para esto).
2. Mejora 2-opt: probar intercambiar pares de paradas en la secuencia y
   quedarse con la que reduzca la distancia total (iterar hasta que no
   haya mejora, típicamente converge en 2-3 pasadas con tan pocas paradas).
3. Con el orden final, hacer UNA llamada a OSRM con todas las coordenadas
   en secuencia (endpoint /route/v1/{profile}/{coords} con múltiples
   waypoints), no una llamada por tramo — más eficiente y evita
   descuadres en las uniones.
```

**Variante A ("Más rápida"):** el paso 1 usa distancia euclídea directa entre paradas.

**Variante B ("Panorámica"):** antes del paso 1, se añaden como "paradas fantasma" (no obligatorias, solo de paso) hasta 2 POIs adicionales de categoría `monumento`/`mirador`/`naturaleza` que estén a menos de 150m de desviación de la ruta directa entre dos paradas consecutivas ya calculada en variante A. Esto se resuelve con una primera llamada a OSRM en modo rápido, comprobando qué POIs cercanos quedan dentro de ese margen de desviación (usando la función `nearest` de OSRM o cálculo de distancia punto-a-línea), y recalculando con ellos incluidos como waypoints intermedios.

### 5.3 Rutas alternativas

OSRM soporta el parámetro `alternatives=true` en el endpoint `/route`, que devuelve hasta 2-3 geometrías alternativas para el tramo más simple (origen-destino directo). Para rutas multi-parada esto es más limitado, así que:
- Si hay **2 paradas exactamente**: mostrar hasta 2 alternativas reales de OSRM (`alternatives=true`), diferenciadas por color (Sección 6.2).
- Si hay **3+ paradas**: no se muestran alternativas de OSRM (no las soporta bien con múltiples waypoints); en su lugar, se ofrece el toggle "Más rápida" vs "Panorámica" como las dos únicas variantes, ya que representan una alternativa real y con sentido, no una alternativa arbitraria de geometría.

---

## 6. RENDERIZADO VISUAL

### 6.1 Iconos por categoría (obligatorio, sistema cerrado — no generar iconos nuevos ad-hoc)

| Categoría | Color base | Forma de icono |
|---|---|---|
| Restaurante/gastronomía | Naranja `#E07A3F` | Cubierto (tenedor+cuchillo) |
| Monumento/histórico | Marrón dorado `#A87C3D` | Columna/arco |
| Naturaleza/parque | Verde `#4A7A5E` | Hoja |
| Mirador/plaza | Azul `#3D6B87` | Ojo/horizonte |
| Negocio DLS recomendado | Color de acento de marca DLS (el definido en el sistema de diseño global) | Pin con logo simplificado DLS |
| Punto de partida del usuario | Negro/gris oscuro `#2B2B2B` | Círculo sólido con punto interior blanco |

Todos los iconos como SVG propios (no librerías de iconos genéricas tipo Font Awesome para esto — deben ser coherentes visualmente entre sí, mismo grosor de trazo y estilo, diseñados como set).

### 6.2 Colores de línea de ruta

- Ruta principal (la seleccionada/activa): color de acento de marca del negocio anfitrión, grosor 5px, con un efecto de "flujo" animado sutil (dash-offset animado en CSS/SVG, muy discreto) para indicar dirección de recorrido.
- Rutas alternativas (cuando existan, Sección 5.3): gris neutro `#B0B0B0`, grosor 3px, sin animación, clicables para promoverlas a ruta principal (al hacer clic, intercambia colores y estilos).
- Flechas de dirección: pequeños triángulos a lo largo de la línea (cada ~150m en el zoom por defecto) indicando sentido de la marcha, no solo el color.

### 6.3 Panel de resumen de ruta

Al calcular la ruta, mostrar un panel fijo (parte inferior en mobile, lateral en desktop) con:
- Distancia total y tiempo estimado.
- Lista ordenada de paradas con su icono de categoría y tiempo parcial hasta cada una ("15 min hasta aquí").
- Botón "Abrir en Google Maps / Apple Maps" como fallback para navegación turn-by-turn real (DLS no debe intentar sustituir la navegación GPS en vivo — esto es planificación y visualización, no un GPS de conducción; el fallback exporta el punto de partida y paradas en el formato de URL de directions de Google Maps).

---

## 7. CASOS LÍMITE (obligatorio cubrir)

- **Ninguna ruta posible** (ej. una parada está en una isla sin conexión peatonal, o el perfil elegido no puede llegar): mostrar mensaje claro por parada afectada ("No se pudo calcular ruta a pie hasta {nombre}, prueba con coche") y permitir recalcular excluyendo esa parada.
- **Usuario cambia de perfil o modo a mitad de visualización**: recalcular sin cerrar el modal, manteniendo las paradas seleccionadas.
- **Servidor OSRM caído o timeout**: fallback a mostrar solo líneas rectas (geodésicas) entre paradas con aviso visible ("Ruta aproximada, no se pudo calcular el trazado real") — nunca dejar al usuario sin nada.
- **Ubicación del usuario muy lejos de la zona** (ej. > 20km del negocio anfitrión): no ofrecer "a pie" por defecto, preseleccionar "coche" y mostrar aviso.

---

## 8. FASES DE IMPLEMENTACIÓN (extienden las fases del documento base, no las sustituyen)

**Fase 6 — Infraestructura de rutas**
1. Desplegar OSRM en Docker con datos de la región, perfiles foot/bike/car.
2. Endpoint backend `/api/zone/route` con la lógica de la Sección 5.

**Fase 7 — Selección y UI de ruta**
3. Checkbox "añadir a ruta" en tarjetas + botón "Planear ruta".
4. Flujo de geolocalización/pin manual (Sección 2).
5. Selectores de perfil y modo (Sección 4).

**Fase 8 — Renderizado y pulido**
6. Iconos, colores y animación de línea (Sección 6).
7. Panel de resumen + export a Google Maps.
8. Cobertura de todos los casos límite de la Sección 7.

**No avanzar de fase sin probar con un caso real de al menos 4 paradas mezclando categorías distintas.**
