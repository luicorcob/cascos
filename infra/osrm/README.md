# OSRM para Modo Ruta

DLS usa tres grafos separados porque el perfil de transporte se aplica durante
el preprocesado de OSRM, no al consultar una misma instancia. El frontend nunca
accede a estos contenedores: solo llama a `POST /api/zone/route`.

## Preparación

1. Descarga en `infra/osrm/data/spain-latest.osm.pbf` un extracto de España que
   incluya Península y Canarias. Verifica la cobertura y la fecha del proveedor
   antes de usarlo en producción.
2. Reserva espacio para tres grafos y ejecuta desde la raíz:

   ```powershell
   powershell -ExecutionPolicy Bypass -File infra/osrm/prepare.ps1
   ```

   El script aplica `car.lua`, `foot.lua` y `bicycle.lua`, y ejecuta la cadena
   cerrada `osrm-extract` + `osrm-contract` para cada perfil.
3. Arranca las tres instancias:

   ```powershell
   docker compose -f infra/osrm/docker-compose.yml up -d
   ```

4. Configura el backend con `OSRM_CAR_URL`, `OSRM_FOOT_URL` y `OSRM_BIKE_URL`
   como se documenta en `.env.example`.

Los puertos se publican solo en loopback. En un despliegue distribuido, elimina
`ports`, usa una red privada y apunta las variables a los nombres DNS internos.
Fija `OSRM_IMAGE` a una versión probada antes de promover a producción; `latest`
se deja como valor de desarrollo para seguir el registro oficial actual.

Si OSRM no responde dentro de `OSRM_ROUTE_TIMEOUT_MS`, el endpoint devuelve una
geometría aproximada y la interfaz lo comunica de forma visible.
