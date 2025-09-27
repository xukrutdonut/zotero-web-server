#!/bin/bash

echo "🚀 Iniciando servidor Zotero HÍBRIDO (desarrollo + proxy)..."

# Detener procesos existentes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "npx serve" 2>/dev/null || true

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

# Iniciar servidor web híbrido (sirve web + proxy API)
echo "🌐 Iniciando servidor híbrido en puerto 8080..."
cd ~/zotero-web-server
cat > hybrid-server.js << 'EOF'
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8080;

// Servir archivos estáticos
app.use(express.static('web'));

// Proxy para API
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    pathRewrite: {
        '^/api': '', // Remueve /api del path
    },
}));

// Servir index.html para cualquier ruta no encontrada (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor híbrido funcionando en puerto ${PORT}`);
    console.log(`📍 Acceso local: http://localhost:${PORT}`);
    console.log(`🌍 Acceso red: http://0.0.0.0:${PORT}`);
});
EOF

# Instalar http-proxy-middleware si no existe
if [ ! -f "package.json" ]; then
    npm init -y > /dev/null
fi

npm install express http-proxy-middleware > /dev/null 2>&1

# Iniciar servidor híbrido
nohup node hybrid-server.js > logs/hybrid.log 2>&1 &
HYBRID_PID=$!
echo $HYBRID_PID > hybrid.pid

sleep 2

# Verificar servidor híbrido
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ Servidor híbrido funcionando en puerto 8080"
else
    echo "❌ Error con servidor híbrido"
    exit 1
fi

IP=$(hostname -I | awk '{print $1}')
ITEMS=$(curl -s http://localhost:3000/library | jq length 2>/dev/null || echo "?")

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
echo "   ✅ Incluye proxy automático para /api"
echo ""
echo "📊 Estado:"
echo "   - API: ✅ Puerto 3000"
echo "   - Web+Proxy: ✅ Puerto 8080" 
echo "   - Elementos en biblioteca: $ITEMS"
echo ""
echo "📊 Monitoreo:"
echo "   - API: tail -f ~/zotero-web-server/logs/api.log"
echo "   - Híbrido: tail -f ~/zotero-web-server/logs/hybrid.log"
echo ""
echo "🛑 Para detener: ./stop-hybrid.sh"
echo ""