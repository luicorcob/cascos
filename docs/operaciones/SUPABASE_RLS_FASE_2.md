# Supabase RLS - Fase 2

Fecha: 2026-07-08.

## Resultado de auditoria local

- No hay SDK de Supabase ni `createClient(...)` en frontend o backend.
- No hay referencias a `service_role` en codigo de aplicacion; solo aparece en documentacion de seguridad.
- `package.json` no incluye `@supabase/supabase-js`.
- La persistencia actual usa JSON local o PostgreSQL directo mediante `server/lib/business-store.mjs`.
- Las tablas inferidas por el codigo son:
  - `locallift_business_meta`
  - `locallift_businesses`
  - `locallift_contacts`
  - `locallift_activities`
  - `locallift_services`
  - `locallift_bookings`
  - `locallift_availability`
  - `locallift_booking_blocks`
  - `locallift_booking_reminders`
  - `locallift_business_events`
  - `locallift_audit_log`
- No hay uso de Supabase Storage en el repo. Las imagenes viven en APIs externas, localStorage, HTML exportado, Cloudflare KV para demos o URLs remotas.

Limitacion: sin credenciales de Supabase no se puede comprobar el estado real de RLS en una instancia. Esta fase deja preparado el SQL que debe ejecutarse en Supabase y las consultas de verificacion.

## Politica propuesta

La aplicacion actual funciona con un backend propio. Por eso la regla segura es que el navegador no escriba directamente en tablas privadas:

| Recurso | anon | authenticated | backend/service_role |
| --- | --- | --- | --- |
| Negocios publicados | `select` solo si `data.status = published` | `select` publico o por pertenencia | completo |
| Servicios y disponibilidad activos | `select` solo si el negocio esta publicado | `select` publico o por pertenencia; escritura desde `editor` | completo |
| Contactos, actividades y reservas | sin acceso directo | lectura de miembros; escritura desde `editor` | completo |
| Bloqueos y recordatorios | sin acceso directo | lectura de miembros; escritura desde `editor` | completo |
| Eventos de negocio | sin acceso directo | lectura de miembros | completo |
| Auditoria | sin acceso directo | lectura desde `admin` | completo |
| Metadatos internos | sin acceso directo | sin acceso directo | completo |

Para mapear usuarios de Supabase Auth con negocios, el SQL crea `locallift_business_members` con roles `owner`, `admin`, `editor` y `viewer`.

## Archivo SQL

Ejecutar:

```text
docs/operaciones/supabase_rls_fase_2.sql
```

El script:

- Crea la tabla de pertenencias `locallift_business_members`.
- Crea helpers `locallift_is_business_member(...)` y `locallift_is_public_business(...)`.
- Activa y fuerza RLS en todas las tablas `locallift_*`.
- Crea politicas explicitas para `anon`, `authenticated` y `service_role`.
- Incluye consultas de verificacion al final del archivo.

## Pasos para aplicar en Supabase

1. Migrar o arrancar la app una vez con `BUSINESS_STORE=postgres` para que existan las tablas `locallift_*`.
2. Ejecutar `docs/operaciones/supabase_rls_fase_2.sql` en el SQL editor de Supabase.
3. Insertar miembros en `locallift_business_members`, por ejemplo:

```sql
insert into public.locallift_business_members (user_id, business_id, role)
values ('00000000-0000-0000-0000-000000000000', 'biz_demo_brasa_norte', 'owner');
```

4. Ejecutar las consultas de verificacion comentadas al final del SQL.
5. Probar con un usuario `anon`, un usuario autenticado sin pertenencia y un usuario miembro.

## Reglas de operacion

- La `service_role key`, si se usa, debe vivir solo en Render o en otro backend de confianza.
- El frontend no debe recibir nunca la `service_role key`.
- Leads, reservas publicas y eventos deben seguir entrando por `/api/public/...`, donde el backend valida y guarda.
- Si se anade Supabase Storage mas adelante, crear buckets sin escritura publica. La lectura publica solo debe existir para assets que realmente se puedan publicar.

## Verificacion local hecha

Comandos usados:

```powershell
rg -n "supabase|SUPABASE|service_role|anon key|anon_key|createClient|from\(|storage|bucket" .
rg -n "locallift_|COLLECTIONS|create table|business_id|auth.uid|RLS|policy" server docs data .env.example
```

Resultado: no hay llamadas frontend a Supabase ni uso local de `service_role` en codigo de aplicacion.
