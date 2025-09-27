#!/bin/bash

echo "🚀 Iniciando servidor Zotero (modo desarrollo)..."

# Detener procesos existentes
pkill -f "node.*server.js" 2>/dev/null || true

# Crear directorio de logs
mkdir -p ~/zotero-web-server/logs

# Iniciar la API
echo "📡 Iniciando API de Zotero..."
cd ~/zotero-web-server/api
ZOTERO_DATA_DIR="/home/arkantu/Zotero" nohup node server.js > ../logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > ../api.pid

sleep 3

# Verificar que la API está funcionando
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ API iniciada correctamente en puerto 3000"
else
    echo "❌ Error iniciando API"
    exit 1
fi

# Iniciar servidor web simple con Node.js
echo "🌐 Iniciando servidor web en puerto 8080..."
cd ~/zotero-web-server
nohup npx serve web -l 8080 > logs/web.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > web.pid

sleep 2

echo ""
echo "🎉 ¡Servidor Zotero iniciado correctamente!"
echo ""
echo "📍 Accede a tu biblioteca en:"
echo "   - Aplicación Web: http://localhost:8080"
echo "   - API directa: http://localhost:3000/library"
echo "   - Health check: http://localhost:3000/health"
echo ""
echo "📊 Monitoreo:"
echo "   - Logs API: tail -f ~/zotero-web-server/logs/api.log"
echo "   - Logs Web: tail -f ~/zotero-web-server/logs/web.log"
echo ""
echo "🛑 Para detener:"
echo "   ./stop-dev.sh"
echo ""