# Plan de Ciberseguridad — DLS Studio

Stack: Supabase (DB + Auth) · Cloudflare (CDN/WAF) · Render (backend) · Unsplash/Pexels/Pixabay APIs · Google Places API

Este plan está dividido en fases. Dáselas a Codex una por una (no todo junto), pide que primero audite y liste hallazgos, y que solo después implemente los cambios de esa fase.

---

## FASE 0 — Auditoría inicial (hacer primero, sin tocar nada)

**Prompt para Codex:**
> Audita este repositorio y genera un informe (sin modificar código todavía) que liste:
> 1. Cualquier API key, token o secreto hardcodeado en el código (buscar en frontend, backend, configs, y también en el historial de git).
> 2. Todas las tablas de Supabase y si tienen RLS (Row Level Security) activado.
> 3. Todos los endpoints del backend y qué validación de input tienen.
> 4. Configuración de CORS actual.
> 5. Si `.env` o similar está en `.gitignore`.
> 6. Dependencias con vulnerabilidades conocidas (`npm audit` / `pip-audit` según corresponda).

⚠️ Si aparece alguna key en el historial de git, **hay que rotarla** (generar una nueva en el servicio correspondiente), no basta con borrarla del código.

---

## FASE 1 — Gestión de secretos

- [ ] Ninguna key de servicio (Supabase `service_role`, Unsplash, Pexels, Pixabay, Google Places, Render) debe estar en código que llegue al navegador.
- [ ] Solo la Supabase `anon key` puede estar en frontend, y solo si RLS está bien configurado (ver Fase 2).
- [ ] Todas las keys viven en variables de entorno (Render dashboard / Cloudflare secrets), nunca en el repo.
- [ ] `.env`, `.env.local`, `.env.*` en `.gitignore`.
- [ ] Documentar (en un `.env.example` sin valores reales) qué variables necesita el proyecto para levantarlo.
- [ ] Rotar cualquier key que haya estado expuesta alguna vez en un commit público.

**Prompt para Codex:**
> Mueve cualquier secreto hardcodeado a variables de entorno. Crea un `.env.example` con las claves necesarias (sin valores reales). Verifica que ningún `console.log` ni respuesta de API exponga keys o tokens completos.

---

## FASE 2 — Supabase: Row Level Security (RLS)

- [ ] Activar RLS en **todas** las tablas sin excepción (por defecto, sin políticas = tabla bloqueada, que es lo seguro).
- [ ] Definir políticas explícitas por tabla:
  - Qué puede leer un usuario anónimo (ej. webs publicadas).
  - Qué puede leer/escribir un usuario autenticado (solo sus propios datos/proyectos).
  - Qué puede hacer un admin (si aplica un rol separado).
- [ ] Las operaciones que requieran `service_role key` deben ejecutarse **solo desde el backend** (Render), nunca desde el cliente.
- [ ] Revisar Storage buckets de Supabase (si los usas para imágenes/assets): que no sean públicos de escritura, solo lectura donde corresponda.

**Prompt para Codex:**
> Para cada tabla de Supabase, genera las políticas RLS necesarias según este esquema: [describe aquí quién puede leer/escribir qué en tu app]. Verifica que ninguna llamada desde el frontend use la service_role key.

---

## FASE 3 — Backend (Render): validación y control de acceso

- [ ] Todo input de usuario (formularios, nombres de negocio, prompts de IA, uploads) se valida y sanitiza en el backend antes de usarse (evitar inyección SQL, XSS, path traversal).
- [ ] Las llamadas a APIs externas (Unsplash, Google Places, generación de IA) pasan siempre por tu backend — el cliente nunca llama directo con la key.
- [ ] Autenticación verificada en cada endpoint sensible (comprobar el JWT de Supabase, no fiarte de lo que diga el frontend).
- [ ] Autorización: comprobar que el usuario autenticado es dueño del recurso que intenta modificar (no solo que esté logueado).
- [ ] Rate limiting en endpoints costosos o sensibles (generación de contenido IA, subida de imágenes, login) para evitar abuso y consumo de cuota de APIs de pago.
- [ ] Manejo de errores que no filtre stack traces ni detalles internos al cliente en producción.

**Prompt para Codex:**
> Añade middleware de validación de input (usando [zod/joi/pydantic, el que uses]) a todos los endpoints. Añade verificación del JWT de Supabase en endpoints protegidos. Añade rate limiting (ej. `express-rate-limit` o equivalente) a los endpoints de generación de IA y subida de archivos. Asegúrate de que los errores en producción no devuelven stack traces al cliente.

---

## FASE 4 — CORS y cabeceras HTTP

- [ ] CORS restringido a tu(s) dominio(s) real(es), nunca `*` en producción.
- [ ] Cabeceras de seguridad: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (o `SAMEORIGIN` si necesitas iframes), `Strict-Transport-Security`.
- [ ] Cookies de sesión (si las usas) con `Secure`, `HttpOnly`, `SameSite=Strict` o `Lax`.

**Prompt para Codex:**
> Configura CORS para aceptar solo peticiones desde [tu dominio]. Añade cabeceras de seguridad estándar (CSP, X-Frame-Options, X-Content-Type-Options, HSTS) en las respuestas del backend.

---

## FASE 5 — Cloudflare

- [ ] Activar WAF (reglas gratuitas básicas contra inyecciones/bots).
- [ ] Forzar HTTPS y HSTS activado.
- [ ] Rate limiting a nivel de Cloudflare en endpoints críticos (login, generación de contenido, contacto).
- [ ] Bot Fight Mode activado si tienes formularios públicos.
- [ ] Page Rules o Firewall Rules para bloquear países/IPs sospechosas si detectas abuso (opcional, según necesidad real).

Esto es configuración en el dashboard de Cloudflare, no algo que Codex programe — pero puedes pedirle que documente en un `SECURITY.md` qué reglas tienes activas y por qué.

---

## FASE 6 — Dependencias y supply chain

- [ ] `npm audit` (o `pip-audit`) integrado en CI, que falle el build si hay vulnerabilidades críticas.
- [ ] Dependabot (o similar) activado en el repo de GitHub para alertas automáticas.
- [ ] Revisar que no haya paquetes con muy pocas descargas/mantenimiento sospechoso antes de añadirlos.

**Prompt para Codex:**
> Añade un workflow de GitHub Actions que corra `npm audit --audit-level=high` (o equivalente) en cada PR y falle si hay vulnerabilidades críticas o altas.

---

## FASE 7 — Logging y monitorización

- [ ] Logs de errores y accesos (sin loggear datos sensibles: passwords, tokens, keys).
- [ ] Alertas ante fallos repetidos de autenticación (posible fuerza bruta).
- [ ] Backups automáticos de Supabase verificados (que existan y que se puedan restaurar).

**Prompt para Codex:**
> Añade logging estructurado de errores y accesos en el backend, asegurándote de que nunca se loguean contraseñas, tokens ni keys completas. Documenta en `SECURITY.md` la política de backups de Supabase.

---

## FASE 8 — Checklist final antes de producción

- [ ] Ningún secreto en el repo (revisar historial de git con `git log -p` o herramientas como `gitleaks`).
- [ ] RLS activo y probado en todas las tablas.
- [ ] CORS restringido.
- [ ] Rate limiting activo en endpoints sensibles.
- [ ] HTTPS forzado en todo el dominio.
- [ ] Dependencias sin vulnerabilidades críticas.
- [ ] `.env.example` documentado, `.env` real fuera del repo.

**Prompt para Codex:**
> Ejecuta gitleaks (o similar) sobre el historial completo del repo y reporta cualquier secreto detectado. Genera un `SECURITY.md` resumiendo las medidas implementadas en este plan.

---

### Nota de uso
Dale esto a Codex fase por fase, revisando lo que cambia antes de pasar a la siguiente. Si en algún punto Codex reescribe lógica de negocio además de lo de seguridad, revísalo con más cuidado — pídele explícitamente "no cambies la lógica de negocio, solo añade las medidas de seguridad indicadas".
