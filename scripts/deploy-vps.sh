#!/usr/bin/env bash
# Deploy completo en el VPS — pullea, buildea, reinicia, verifica.
# Uso: bash scripts/deploy-vps.sh
# Detecta automáticamente el path del repo y el container de PocketBase.
set -e

echo "════════════════════════════════════════════════"
echo "  DRIP BURGER — DEPLOY VPS"
echo "════════════════════════════════════════════════"

# ── 1) Encontrar el repo ────────────────────────────────────────────
echo ""
echo "▸ Buscando el repo drip-burger..."
REPO=""
for candidate in \
    "/opt/drip-burger" \
    "/home/$(whoami)/drip-burger" \
    "/root/drip-burger" \
    "/var/www/drip-burger"; do
    if [ -d "$candidate/.git" ] && [ -f "$candidate/apps/web/package.json" ]; then
        REPO="$candidate"
        break
    fi
done

if [ -z "$REPO" ]; then
    REPO=$(find / -name ".git" -path "*drip*" -not -path "*/node_modules/*" 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
fi

if [ -z "$REPO" ] || [ ! -d "$REPO/apps/web" ]; then
    echo "❌ No encontré el repo. Pasá el path manual:"
    echo "   REPO=/ruta/al/repo bash scripts/deploy-vps.sh"
    exit 1
fi

echo "  Repo: $REPO"
cd "$REPO"

# ── 2) Pull de los últimos cambios ──────────────────────────────────
echo ""
echo "▸ git pull origin main..."
BEFORE=$(git rev-parse --short HEAD)
git fetch origin
git pull origin main
AFTER=$(git rev-parse --short HEAD)
echo "  Antes: $BEFORE"
echo "  Ahora: $AFTER"
if [ "$BEFORE" = "$AFTER" ]; then
    echo "  ⚠ El repo ya estaba al día. (puede ser cache de build o branch incorrecto)"
fi

# ── 3) Reiniciar PocketBase para aplicar migraciones ────────────────
echo ""
echo "▸ Reiniciando PocketBase..."
PB=$(docker ps --format '{{.Names}}' | grep -iE "burgapp_pocket|drip.*pocket|pocketbase" | head -1)
if [ -z "$PB" ]; then
    echo "  ⚠ Container de PB no encontrado. Containers actuales:"
    docker ps --format '  - {{.Names}}: {{.Image}}'
    echo "  Setealo manual: PB=nombre_del_container bash scripts/deploy-vps.sh"
else
    echo "  Container: $PB"
    docker restart "$PB"
    echo "  Esperando 5s a que arranque..."
    sleep 5
    docker logs --tail 10 "$PB" 2>&1 | tail -10
fi

# ── 4) Verificar que la collection clientes ya existe ────────────────
echo ""
echo "▸ Verificando collection clientes..."
RESP=$(curl -s "http://localhost:8090/api/collections/clientes/records?perPage=1")
echo "  $RESP" | head -c 200
if echo "$RESP" | grep -q "Missing collection"; then
    echo ""
    echo "  ❌ La migración NO se aplicó. Probá restart manual:"
    echo "     docker restart $PB"
else
    echo ""
    echo "  ✓ Collection clientes accesible"
fi

# ── 5) Rebuild del frontend ─────────────────────────────────────────
echo ""
echo "▸ Build del frontend..."
cd "$REPO/apps/web"
npm install --silent 2>&1 | tail -3
echo "  Building..."
npm run build 2>&1 | tail -5
echo "  Bundle nuevo:"
ls -lt dist/assets/index-*.js 2>/dev/null | head -1

# ── 6) Restart del API + web server ─────────────────────────────────
echo ""
echo "▸ Restart del API y servidor web..."

# Buscar pm2
if command -v pm2 &> /dev/null; then
    echo "  Reiniciando con pm2..."
    pm2 restart all 2>&1 | tail -10
fi

# Buscar containers web/api
WEB_API=$(docker ps --format '{{.Names}}' | grep -iE "drip.*web|drip.*api|nginx" | head -3)
if [ -n "$WEB_API" ]; then
    echo "  Reiniciando containers web/api: $WEB_API"
    for c in $WEB_API; do
        docker restart "$c"
    done
fi

# Recargar nginx si está como service
if command -v systemctl &> /dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
    echo "  Reload nginx..."
    sudo nginx -t && sudo systemctl reload nginx
fi

# ── 7) Verificación final ────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "  VERIFICACIÓN FINAL"
echo "════════════════════════════════════════════════"
echo ""
echo "Bundle live:"
curl -s -L "https://dripburger.shop" 2>&1 | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1
echo ""
echo "Clientes accesible:"
curl -s "https://pb.dripburger.shop/api/collections/clientes/records?perPage=1" | head -c 200
echo ""
echo ""
echo "Commit del repo: $AFTER"
echo "Esperado: df36aba (o más nuevo)"
echo ""
echo "Si el bundle live no cambió de hash, hay un servidor web (nginx, pm2, etc)"
echo "que está sirviendo desde un dist/ distinto. Mirá el log para hint."
