# Runbook operativo del primer piloto

Este procedimiento cubre las dos tareas diarias que protegen los datos del
primer piloto: revisar el estado del backend y recuperar una copia si hay un
incidente.

## Responsable diario

- Responsable: Luis.
- Hora limite: 10:00, zona `Europe/Madrid`, todos los dias con un piloto activo.
- Sustituto: debe nombrarse antes de cualquier ausencia de mas de un dia.
- Registro: anotar fecha, resultado y accion tomada en el marcador diario del
  plan comercial.

## Revision diaria de salud

Abrir:

```text
https://tu-api.com/api/health
```

La revision es correcta solo si:

- La respuesta HTTP es `200`.
- `ok` es `true`.
- `database.readable` y `database.writable` son `true`.
- Los conteos de negocios, contactos, reservas y eventos son plausibles.
- No hay un descenso inesperado de conteos respecto al dia anterior.

Si falla:

1. No publicar cambios ni reiniciar repetidamente el servicio.
2. Guardar una captura o copia de la respuesta.
3. Revisar logs, disco persistente y variables de entorno del proveedor.
4. Si faltan datos o la base no se puede leer, detener escrituras y seguir el
   procedimiento de restauracion.
5. Repetir `/api/health` y la prueba de lead/reserva antes de cerrar el
   incidente.

## Restaurar una copia

El backend debe estar detenido para evitar escrituras durante la restauracion.
Selecciona una copia de `BUSINESS_DB_BACKUP_DIR` anterior al incidente y ejecuta:

```powershell
npm.cmd run restore:businesses -- "data/backups/business-db.FECHA.etiqueta.json" --confirm
```

En produccion, configura primero las rutas persistentes:

```powershell
$env:BUSINESS_DB_FILE="/data/business-db.json"
$env:BUSINESS_DB_BACKUP_DIR="/data/backups"
npm.cmd run restore:businesses -- "/data/backups/business-db.FECHA.etiqueta.json" --confirm
```

El comando:

- Rechaza JSON invalido o sin el array `businesses`.
- Crea una copia `pre-restore` de la base actual.
- Escribe la restauracion de forma atomica.
- Vuelve a leer la base y muestra sus conteos.

Despues de restaurar:

1. Arrancar el backend.
2. Confirmar que `/api/health` devuelve `ok: true`.
3. Comparar conteos con la copia seleccionada.
4. Abrir el portal y comprobar el negocio afectado.
5. Crear un lead y una reserva de prueba, y confirmar que llegan al portal.
6. Registrar la causa, copia usada, hora y resultado.

Si la copia restaurada no es correcta, detener el backend y restaurar la copia
`pre-restore` creada por el comando.
