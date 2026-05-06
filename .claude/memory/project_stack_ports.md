---
name: Stack y puertos del proyecto
description: web 3001, api 3002, PB 8090. Dominios prod: dripburger.shop / api.dripburger.shop.
type: project
originSessionId: 2ff2d5f9-9835-48f0-bdeb-e5e2dc461ec7
---
Monorepo con tres apps:
- `apps/web` — React + Vite, puerto **3001** (dev/preview). En prod: `https://dripburger.shop`.
- `apps/api` — Node + Express, puerto **3002**. En prod: `https://api.dripburger.shop`.
- `apps/pocketbase` — PB en Docker (container `burgapp_pocketbase`), puerto **8090**. URL prod: `https://pb.dripburger.shop` (o la que esté en `.env`).

**Why:** Bruno corrige al inicio de varias sesiones cuando un agent intenta arrancar Vite en 3000 — choca con otros proyectos suyos (Sinatra, Cosecha). El port 3001 está fijado en `apps/web/package.json`.

**How to apply:**
- Para arrancar el front: `cd apps/web && npm run dev` (ya configurado en 3001).
- API: `cd apps/api && npm run dev`.
- PB: ver memoria `reference_local_pb.md`.
- Defaults de URLs en código apuntan a producción (`payments.js` usa `dripburger.shop` y `api.dripburger.shop` por default), así que en local hay que setear `FRONTEND_URL` y `API_PUBLIC_URL` en `.env` para testing de MP.
