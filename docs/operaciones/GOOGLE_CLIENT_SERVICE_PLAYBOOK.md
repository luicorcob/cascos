# Playbook Google gestionado - LocalLift

Objetivo: que el cliente no solo tenga una web bonita, sino una operacion Google completa: correo profesional, perfil de empresa, reservas, reseñas y reporte mensual.

## Que vendemos

- Alta o puesta en orden de Google Workspace.
- Creacion de correo profesional del negocio.
- Configuracion de Google Business Profile.
- Conexion de Maps, Place ID, review URL y acciones de reserva.
- Calendario para citas/reservas cuando aplique.
- Solicitud y gestion de reseñas.
- Reporte mensual con acciones y resultados.

## Lo que necesitamos del cliente

- Dominio o decision de dominio.
- Titular legal y datos de facturacion.
- Acceso administrador a Google Workspace si ya existe.
- Acceso como manager/owner al Google Business Profile.
- Calendario que se usara para reservas.
- Politica de reservas: duracion, buffers, capacidad, horarios y quien confirma.
- Autorizacion expresa para publicar respuestas a reseñas.

## Flujo de implantacion

1. Revisar dominio y Workspace.
2. Crear correo profesional en Workspace: `info@`, `hola@`, `reservas@` o `citas@`.
3. Forzar cambio de contraseña y entregar acceso al cliente.
4. Verificar o reclamar Google Business Profile.
5. Sincronizar nombre, categoria, telefono, direccion, horarios, web y servicios.
6. Configurar enlace de mapa, reseñas y reserva.
7. Conectar Calendar para disponibilidad y reservas, si procede.
8. Activar mensajes de solicitud de reseña post-visita.
9. Crear reporte mensual.

## Politicas importantes

- No crear cuentas Gmail personales para clientes. Usar Google Workspace con dominio del cliente.
- No guardar claves en el HTML exportado.
- No publicar respuestas a reseñas sin aprobacion humana.
- No crear reservas sin validar horario, buffers y datos de contacto.
- Mantener tokens OAuth cifrados y separados por cliente.

La configuracion tecnica y los pasos externos estan en
[`GOOGLE_CLOUD_SETUP.md`](GOOGLE_CLOUD_SETUP.md).

## Backend productivo

La integracion vive en el servidor principal y se opera desde la pestana
`Google` de `pages/business-dashboard.html`. Incluye OAuth persistente por
negocio, refresh automatico, cifrado, Places, Calendar, Business Profile,
resenas, performance y Workspace.

Acciones sensibles:

- Responder una resena exige revision humana y `confirm: true`.
- Cambiar Business Profile exige `confirm: true`.
- Crear un usuario Workspace exige autorizacion del cliente y `confirm: true`.
- Las reservas locales se sincronizan con Calendar cuando la cuenta esta
  conectada.

## Backend legacy de ejemplo

`examples/google-integration.example.mjs` incluye:

- `GET /api/google/place`
- `POST /api/google/availability`
- `POST /api/google/book`
- `GET /api/google/business/accounts`
- `GET /api/google/business/locations`
- `GET /api/google/reviews`
- `POST /api/google/reviews/reply`
- `POST /api/google/workspace/user`
- `POST /api/google/review-request`

Variables relevantes:

```powershell
$env:GOOGLE_MAPS_API_KEY="maps_api_key"
$env:GOOGLE_CALENDAR_ACCESS_TOKEN="oauth_calendar"
$env:GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN="oauth_business_profile"
$env:GOOGLE_WORKSPACE_ADMIN_ACCESS_TOKEN="oauth_admin_workspace"
node examples/google-integration.example.mjs
```

## Oferta mensual

- Revisar datos de Google Business Profile.
- Revisar reseñas nuevas y proponer respuestas.
- Enviar campañas de reseñas a clientes recientes.
- Revisar reservas, leads y conversiones.
- Ajustar web, FAQ y chatbot segun preguntas reales.
