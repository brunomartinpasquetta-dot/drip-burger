#!/usr/bin/env bash
# Levanta el container de PocketBase de drip-burger en local y aplica todas
# las migraciones pendientes de pb_migrations/. Si el puerto 8090 lo está
# usando otro container (ej: sinatra_pb), pregunta antes de apagarlo.
#
# Uso: bash scripts/start-pb-local.sh
set -e

DRIP_PB="burgapp_pocketbase"
PORT="8090"

echo "════════════════════════════════════════════════"
echo "  DRIP BURGER — START PB LOCAL"
echo "════════════════════════════════════════════════"

# 1) Detectar si el puerto 8090 está ocupado por otro container
HOLDER=$(docker ps --format '{{.Names}}\t{{.Ports}}' | awk -v p=":${PORT}->" '$0 ~ p {print $1}' | head -1)

if [ -n "$HOLDER" ] && [ "$HOLDER" != "$DRIP_PB" ]; then
    echo ""
    echo "⚠ Puerto $PORT ocupado por: $HOLDER"
    read -p "¿Apagarlo para levantar drip? [y/N] " ans
    if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
        docker stop "$HOLDER"
        echo "  → $HOLDER apagado"
    else
        echo "  Abortando. Levantá drip en otro puerto editando docker-compose."
        exit 1
    fi
fi

# 2) Asegurar que el container drip exista
EXISTS=$(docker ps -a --format '{{.Names}}' | grep -c "^${DRIP_PB}\$" || true)
if [ "$EXISTS" -eq 0 ]; then
    echo "❌ Container $DRIP_PB no existe. Hay que crearlo (docker run/compose)."
    echo "   Buscá docker-compose.yml o docker-compose.local.yml en el proyecto."
    find /Users/brunopasquetta/drip-burger -maxdepth 3 -name "docker-compose*" -not -path "*/node_modules/*" 2>/dev/null | head -3
    exit 1
fi

# 3) Arrancar
echo ""
echo "▸ Arrancando $DRIP_PB..."
docker start "$DRIP_PB"
sleep 3

# 4) Logs (las migraciones se aplican al startup — buscar errores)
echo ""
echo "▸ Logs del startup (últimas 30 líneas):"
docker logs --tail 30 "$DRIP_PB" 2>&1 | tail -30

# 5) Verificación de que el schema tiene los campos esperados
echo ""
echo "▸ Verificación de schema..."
sleep 1

check_field() {
    local coll="$1"
    local field="$2"
    local has=$(curl -s "http://localhost:${PORT}/api/collections/${coll}/records?perPage=1" \
        | python3 -c "import json,sys; d=json.load(sys.stdin); items=d.get('items',[]); print('YES' if items and '${field}' in items[0] else 'NO')" 2>&1)
    if [ "$has" = "YES" ]; then
        echo "  ✓ $coll.$field"
    else
        echo "  ✗ $coll.$field (FALTA — la migración no aplicó)"
    fi
}

check_collection() {
    local coll="$1"
    local code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/api/collections/${coll}/records?perPage=1")
    if [ "$code" = "200" ]; then
        echo "  ✓ collection $coll"
    else
        echo "  ✗ collection $coll (HTTP $code)"
    fi
}

check_collection "settings"
check_collection "orders"
check_collection "jornadas"
check_collection "movimientos_caja"
check_collection "clientes"
check_collection "integrations"
echo ""
check_field "settings" "transferencia_titular"
check_field "settings" "transferencia_alias"
check_field "settings" "transferencia_cbu"

echo ""
echo "════════════════════════════════════════════════"
echo "  Si algún ✗ apareció, los logs de arriba dicen por qué."
echo "  Si todo ✓: dale F5 al frontend con cache limpio."
echo "════════════════════════════════════════════════"
