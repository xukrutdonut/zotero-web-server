#!/bin/bash

echo "🛑 Deteniendo servidor Zotero COMPLETO..."

# Detener API
if [ -f ~/zotero-web-server/api.pid ]; then
    API_PID=$(cat ~/zotero-web-server/api.pid)
    if kill -0 $API_PID 2>/dev/null; then
        kill $API_PID
        echo "✅ API detenida (PID: $API_PID)"
    fi
    rm ~/zotero-web-server/api.pid
fi

# Detener servidor híbrido completo
if [ -f ~/zotero-web-server/hybrid-complete.pid ]; then
    HYBRID_PID=$(cat ~/zotero-web-server/hybrid-complete.pid)
    if kill -0 $HYBRID_PID 2>/dev/null; then
        kill $HYBRID_PID
        echo "✅ Servidor híbrido detenido (PID: $HYBRID_PID)"
    fi
    rm ~/zotero-web-server/hybrid-complete.pid
fi

# Detener otros procesos si existen
for pid_file in web.pid hybrid.pid; do
    if [ -f ~/zotero-web-server/$pid_file ]; then
        PID=$(cat ~/zotero-web-server/$pid_file)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
        fi
        rm ~/zotero-web-server/$pid_file
    fi
done

# Limpiar procesos restantes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*hybrid-server" 2>/dev/null || true
pkill -f "npx serve" 2>/dev/null || true

echo "🎉 Todos los servicios detenidos completamente"