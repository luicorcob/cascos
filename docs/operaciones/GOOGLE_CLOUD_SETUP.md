# Alta productiva de Google para LocalLift

Esta guia deja operativo el backend Google multi-negocio incluido en el
servidor principal. El codigo ya cubre OAuth persistente, refresh automatico,
cifrado de tokens por negocio, Places, Calendar, Business Profile, resenas,
performance y altas de usuarios Workspace.

## Intervencion humana obligatoria

Google no permite automatizar el alta inicial del proyecto, el consentimiento
del propietario ni la aprobacion de Business Profile API. Una persona con
permisos debe completar estos pasos:

1. Crear o elegir un proyecto en Google Cloud Console.
2. Configurar la pantalla de consentimiento OAuth.
3. Crear un cliente OAuth de tipo `Web application`.
4. Habilitar las APIs necesarias.
5. Guardar las variables secretas en el backend.
6. Iniciar la conexion desde el dashboard y aceptar el consentimiento con la
   cuenta correcta de cada negocio.

## APIs que hay que habilitar

Base:

- Places API (New).
- Google Calendar API.
- Admin SDK API, solo si se gestionaran usuarios de Google Workspace.

Business Profile:

- Solicitar acceso a Business Profile APIs.
- Google My Business API.
- My Business Account Management API.
- My Business Business Information API.
- My Business Place Actions API.
- Business Profile Performance API.

Google documenta que Business Profile API exige aprobacion previa y que el
solicitante debe gestionar un perfil verificado y activo durante al menos
60 dias:

- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/content/basic-setup

## Cliente OAuth web

Configurar estos redirect URI exactos, segun entorno:

```text
http://127.0.0.1:5173/api/google/oauth/callback
https://TU_DOMINIO/api/google/oauth/callback
```

El URI usado en `GOOGLE_OAUTH_REDIRECT_URI` debe coincidir caracter por
caracter con uno de los autorizados en Google Cloud.

Scopes que solicita LocalLift de forma incremental:

```text
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.freebusy
https://www.googleapis.com/auth/business.manage
https://www.googleapis.com/auth/admin.directory.user
```

## Variables de entorno

En local se puede crear un archivo `.env` a partir de `.env.example`; el
servidor lo carga automaticamente y Git/Docker lo ignoran. En cloud, guardar
las mismas variables como secretos del servicio.

```text
GOOGLE_MAPS_API_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://TU_DOMINIO/api/google/oauth/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=
GOOGLE_AUTH_DB_FILE=/data/google-auth-db.json
GOOGLE_CALENDAR_ID=primary
GOOGLE_OAUTH_PROMPT=consent
```

`GOOGLE_TOKEN_ENCRYPTION_KEY` debe ser aleatoria, estable y tener al menos
32 caracteres. Si se cambia despues de conectar negocios, los tokens guardados
dejaran de poder descifrarse.

Los antiguos tokens globales siguen admitidos solo para migracion:

```text
GOOGLE_CALENDAR_ACCESS_TOKEN=
GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN=
GOOGLE_WORKSPACE_ADMIN_ACCESS_TOKEN=
```

No deben usarse para nuevos clientes porque mezclan permisos entre negocios.

## Verificacion

```powershell
npm.cmd run google:check
npm.cmd run test:google
npm.cmd run check
```

Despues:

1. Arrancar `npm.cmd start`.
2. Abrir `pages/business-dashboard.html`.
3. Elegir el negocio y abrir la pestana `Google`.
4. Pulsar `Conectar todo` o conectar cada servicio por separado.
5. Completar el consentimiento en Google.
6. Volver al dashboard y pulsar `Actualizar estado`.
7. Pulsar `Probar conexiones` y revisar el diagnostico real.
8. Sincronizar Places y crear una reserva de prueba.
9. Confirmar que la reserva contiene `google.eventId`.

## Seguridad y aprobaciones

- Los tokens se guardan cifrados en `GOOGLE_AUTH_DB_FILE`, nunca en la ficha
  publica del negocio ni en el HTML.
- Las rutas Google administrativas quedan protegidas por
  `LOCALLIFT_ADMIN_TOKEN`.
- Las respuestas a resenas, cambios de Business Profile y altas Workspace
  funcionan en dry-run hasta recibir `confirm: true`.
- Workspace requiere que la cuenta que da consentimiento tenga permisos de
  administrador sobre el dominio del cliente.
- No se crean cuentas Gmail personales; se crean usuarios del dominio
  Google Workspace del cliente.

## Recuperacion

- Si un refresh token deja de funcionar, desconectar y volver a conectar el
  negocio desde el dashboard.
- Si se pierde `GOOGLE_TOKEN_ENCRYPTION_KEY`, no se pueden recuperar los
  tokens existentes: hay que reconectar cada negocio.
- `GOOGLE_AUTH_DB_FILE` debe vivir en almacenamiento persistente y entrar en
  la politica de backups del servidor.
