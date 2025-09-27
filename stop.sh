#!/bin/bash

echo "🛑 Deteniendo servidor Zotero..."

# Detener Nginx
sudo systemctl stop nginx
echo "✅ Nginx detenido"

# Detener API
if [ -f ~/zotero-web-server/api.pid ]; then
    API_PID=$(cat ~/zotero-web-server/api.pid)
    if kill -0 $API_PID 2>/dev/null; then
        kill $API_PID
        echo "✅ API detenida (PID: $API_PID)"
    else
        echo "⚠️  API ya estaba detenida"
    fi
    rm ~/zotero-web-server/api.pid
else
    # Buscar y matar cualquier proceso de la API
    pkill -f "node.*server.js" && echo "✅ API detenida" || echo "⚠️  API ya estaba detenida"
fi

echo "🎉 Servidor Zotero detenido completamente"