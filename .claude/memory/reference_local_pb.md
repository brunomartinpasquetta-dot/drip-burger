---
name: Arranque PocketBase local
description: bash scripts/start-pb-local.sh — levanta el container burgapp_pocketbase en puerto 8090 y verifica migraciones.
type: reference
originSessionId: 2ff2d5f9-9835-48f0-bdeb-e5e2dc461ec7
---
Para levantar PB local: `bash scripts/start-pb-local.sh`. El script:
- Detecta si el puerto 8090 lo está ocupando otro container (típico: `sinatra_pb` del proyecto hermano) y avisa.
- Arranca `burgapp_pocketbase` (Docker).
- Hace curl al `_pb_health` y reporta el estado.

Cuando agrego una migración nueva en `apps/pocketbase/pb_migrations/`, hay que **reiniciar el container** para que PB la levante: `docker restart burgapp_pocketbase` (o re-ejecutar el script).

Admin URL local: http://localhost:8090/_/. Credenciales en `.env` o las que Bruno cargó manualmente.
