# Dependencias y supply chain - Fase 6

Fecha: 2026-07-09.

## Resultado local

- El proyecto usa npm con `package-lock.json` version 3.
- No hay ecosistema Python ni `requirements.txt`; no aplica `pip-audit`.
- No se han anadido dependencias nuevas en esta fase.
- Auditoria ejecutada en local:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
$env:npm_config_cache='.npm-cache'
npm.cmd audit --audit-level=high
```

Resultado: `found 0 vulnerabilities`.

## CI

Se anadio `.github/workflows/dependency-audit.yml`.

El workflow:

- Se ejecuta en cada `pull_request` y manualmente con `workflow_dispatch`.
- Usa Node `22.19.0`, igual que el minimo declarado en `package.json`.
- Instala dependencias bloqueadas con `npm ci --ignore-scripts --no-audit`.
- Ejecuta `npm audit --audit-level=high`.
- Falla el PR si npm reporta vulnerabilidades altas o criticas.

`--ignore-scripts` reduce el riesgo de ejecutar scripts de instalacion de
terceros durante una comprobacion de seguridad.

## Dependabot

Se anadio `.github/dependabot.yml` para:

- Dependencias npm del directorio raiz, semanalmente los lunes a las 08:00.
- GitHub Actions, semanalmente los lunes a las 08:30.

En GitHub, revisar tambien `Settings > Code security and analysis` y mantener
activas las opciones de Dependabot alerts y Dependabot security updates si el
repositorio las tiene disponibles.

## Politica antes de anadir paquetes

Antes de introducir una dependencia nueva:

1. Preferir APIs nativas de Node o utilidades ya presentes en el repo.
2. Revisar mantenimiento reciente, issues abiertos, licencia y tamano del
   arbol transitivo.
3. Evitar paquetes de bajo mantenimiento para tareas simples.
4. Ejecutar `npm.cmd audit --audit-level=high` antes de abrir el PR.
5. Confirmar que el workflow `Dependency audit` pasa en GitHub.
