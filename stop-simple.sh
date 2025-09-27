#!/bin/bash

echo "🛑 Deteniendo servidor Zotero SIMPLE..."

# Detener API
if [ -f ~/zotero-web-server/api.pid ]; then
    API_PID=$(cat ~/zotero-web-server/api.pid)
    if kill -0 $API_PID 2>/dev/null; then
        kill $API_PID
        echo "✅ API detenida (PID: $API_PID)"
    fi
    rm ~/zotero-web-server/api.pid
fi

# Detener servidor web simple
if [ -f ~/zotero-web-server/web-simple.pid ]; then
    WEB_PID=$(cat ~/zotero-web-server/web-simple.pid)
    if kill -0 $WEB_PID 2>/dev/null; then
        kill $WEB_PID
        echo "✅ Servidor web detenido (PID: $WEB_PID)"
    fi
    rm ~/zotero-web-server/web-simple.pid
fi

# Limpiar enlaces simbólicos
cd ~/zotero-web-server/web
rm -f storage library 2>/dev/null || true

# Limpiar otros procesos
pkill -f "npx serve" 2>/dev/null || true
pkill -f "node.*server.js" 2>/dev/null || true

echo "🎉 Servidor simple detenido completamente"