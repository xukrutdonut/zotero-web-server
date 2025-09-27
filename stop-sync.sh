#!/bin/bash

echo "🛑 Deteniendo servidor Zotero SINCRONIZADO..."

# Detener API sincronizada
if [ -f ~/zotero-web-server/api-sync.pid ]; then
    API_PID=$(cat ~/zotero-web-server/api-sync.pid)
    if kill -0 $API_PID 2>/dev/null; then
        kill $API_PID
        echo "✅ API sincronizada detenida (PID: $API_PID)"
    fi
    rm ~/zotero-web-server/api-sync.pid
fi

# Detener servidor web sincronizado
if [ -f ~/zotero-web-server/web-sync.pid ]; then
    WEB_PID=$(cat ~/zotero-web-server/web-sync.pid)
    if kill -0 $WEB_PID 2>/dev/null; then
        kill $WEB_PID
        echo "✅ Servidor web detenido (PID: $WEB_PID)"
    fi
    rm ~/zotero-web-server/web-sync.pid
fi

# Limpiar otros archivos PID si existen
for pid_file in api.pid web.pid web-simple.pid hybrid-complete.pid; do
    if [ -f ~/zotero-web-server/$pid_file ]; then
        PID=$(cat ~/zotero-web-server/$pid_file 2>/dev/null)
        if [ -n "$PID" ] && kill -0 $PID 2>/dev/null; then
            kill $PID
        fi
        rm ~/zotero-web-server/$pid_file
    fi
done

# Limpiar enlaces simbólicos
cd ~/zotero-web-server/web
rm -f storage library 2>/dev/null || true

# Limpiar procesos restantes
pkill -f "npx serve" 2>/dev/null || true
pkill -f "node.*server.js" 2>/dev/null || true

echo "🎉 Servidor sincronizado detenido completamente"
echo "📡 WebSocket y sincronización en tiempo real desactivados"