#!/bin/bash

echo "🚀 Iniciando servidor Zotero HÍBRIDO CORREGIDO..."

# Detener procesos existentes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*hybrid-server" 2>/dev/null || true

# Crear directorio de logs
mkdir -p ~/zotero-web-server/logs

# Iniciar la API en puerto 3000
echo "📡 Iniciando API de Zotero en puerto 3000..."
cd ~/zotero-web-server/api
ZOTERO_DATA_DIR="/home/arkantu/Zotero" nohup node server.js > ../logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > ../api.pid

sleep 3

# Verificar API
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ API funcionando en puerto 3000"
else
    echo "❌ Error con API"
    exit 1
fi

# Instalar dependencias si no existen
cd ~/zotero-web-server
if [ ! -f "package.json" ]; then
    npm init -y > /dev/null
fi

# Instalar dependencias necesarias
npm install express http-proxy-middleware > /dev/null 2>&1

# Iniciar servidor híbrido corregido
echo "🌐 Iniciando servidor híbrido en puerto 8080..."
nohup node hybrid-server-fixed.js > logs/hybrid.log 2>&1 &
HYBRID_PID=$!
echo $HYBRID_PID > hybrid.pid

sleep 3

# Verificar servidor híbrido
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ Servidor híbrido funcionando en puerto 8080"
else
    echo "❌ Error con servidor híbrido"
    cat logs/hybrid.log
    exit 1
fi

IP=$(hostname -I | awk '{print $1}')

echo ""
echo "🎉 ¡Servidor Zotero HÍBRIDO iniciado correctamente!"
echo "================================================"
echo ""
echo "📍 Acceso directo:"
echo "   - Local: http://localhost:8080"
echo "   - Red local: http://$IP:8080"
echo ""
echo "🌐 Para tu Nginx Proxy Manager:"
echo "   Domain: zotero.serviciosylaboratoriodomestico.site" 
echo "   Forward to: http://$IP:8080"
echo "   ✅ Proxy automático: /api -> API interna"
echo ""
echo "🧪 Pruebas:"
echo "   - Web: curl -s http://localhost:8080 | head -5"
echo "   - API: curl -s http://localhost:8080/api/health"
echo "   - Biblioteca: curl -s http://localhost:8080/api/library | head -3"
echo ""
echo "🛑 Para detener: ./stop-hybrid.sh"
echo ""