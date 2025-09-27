#!/bin/bash

echo "🛑 Deteniendo servidor Zotero HÍBRIDO..."

# Detener API
if [ -f ~/zotero-web-server/api.pid ]; then
    API_PID=$(cat ~/zotero-web-server/api.pid)
    if kill -0 $API_PID 2>/dev/null; then
        kill $API_PID
        echo "✅ API detenida (PID: $API_PID)"
    fi
    rm ~/zotero-web-server/api.pid
fi

# Detener servidor híbrido
if [ -f ~/zotero-web-server/hybrid.pid ]; then
    HYBRID_PID=$(cat ~/zotero-web-server/hybrid.pid)
    if kill -0 $HYBRID_PID 2>/dev/null; then
        kill $HYBRID_PID
        echo "✅ Servidor híbrido detenido (PID: $HYBRID_PID)"
    fi
    rm ~/zotero-web-server/hybrid.pid
fi

# Detener servidor web si existe
if [ -f ~/zotero-web-server/web.pid ]; then
    WEB_PID=$(cat ~/zotero-web-server/web.pid)
    if kill -0 $WEB_PID 2>/dev/null; then
        kill $WEB_PID
        echo "✅ Servidor web detenido (PID: $WEB_PID)"
    fi
    rm ~/zotero-web-server/web.pid
fi

# Limpiar procesos restantes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*hybrid-server.js" 2>/dev/null || true
pkill -f "npx serve" 2>/dev/null || true

echo "🎉 Todos los servicios detenidos completamente"