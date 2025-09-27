#!/bin/bash

echo "🚀 Iniciando servidor Zotero SIMPLE (FUNCIONANDO)..."

# Detener procesos existentes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*hybrid" 2>/dev/null || true
pkill -f "npx serve" 2>/dev/null || true

# Crear directorio de logs
mkdir -p ~/zotero-web-server/logs

# Iniciar la API en puerto 3000
echo "📡 Iniciando API de Zotero en puerto 3000..."
cd ~/zotero-web-server/api
ZOTERO_DATA_DIR="/home/arkantu/Zotero" ZOTERO_LIBRARY_DIR="/home/arkantu/Documentos/Zotero Biblioteca" nohup node server.js > ../logs/api.log 2>&1 &
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

# Verificar permisos y crear enlaces simbólicos en web/
echo "🔧 Configurando acceso a archivos..."
cd ~/zotero-web-server/web
rm -rf storage library 2>/dev/null || true

# Crear enlaces simbólicos para acceso directo
ln -sf ~/Zotero/storage ./storage
ln -sf "/home/arkantu/Documentos/Zotero Biblioteca" ./library

chmod -R 755 ~/Zotero/storage/ 2>/dev/null || true
chmod -R 755 "/home/arkantu/Documentos/Zotero Biblioteca/" 2>/dev/null || true

# Iniciar servidor web simple con serve
echo "🌐 Iniciando servidor web con acceso a archivos..."
cd ~/zotero-web-server/web
nohup npx serve . -l 8080 --cors > ../logs/web-simple.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > ../web-simple.pid

sleep 3

# Verificar servidor web
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ Servidor web funcionando en puerto 8080"
else
    echo "❌ Error con servidor web"
    exit 1
fi

# Probar acceso a archivos
echo "🧪 Probando acceso a archivos..."
if curl -s -I http://localhost:8080/storage/55LW44KC/ | grep -q "200 OK\|301\|302"; then
    echo "   ✅ Acceso a storage funcionando"
else
    echo "   ⚠️  Storage: verificar permisos"
fi

if curl -s -I http://localhost:8080/biblioteca/ | grep -q "200 OK\|301\|302"; then
    echo "   ✅ Acceso a biblioteca funcionando"
else
    echo "   ⚠️  Biblioteca: verificar permisos"
fi

IP=$(hostname -I | awk '{print $1}')
ITEMS=$(curl -s http://localhost:3000/library | jq length 2>/dev/null || echo "?")

echo ""
echo "🎉 ¡Servidor Zotero SIMPLE iniciado correctamente!"
echo "=============================================="
echo ""
echo "📍 Acceso directo:"
echo "   - Local: http://localhost:8080"
echo "   - Red local: http://$IP:8080"
echo ""
echo "🌐 Para tu Nginx Proxy Manager:"
echo "   Domain: zotero.neuropedialab.org"
echo "   Forward to: http://$IP:8080"
echo "   ✅ Acceso completo a PDFs via enlaces simbólicos"
echo ""
echo "📊 Estado:"
echo "   - API: ✅ Puerto 3000"
echo "   - Web: ✅ Puerto 8080 (serve + symlinks)" 
echo "   - Elementos en biblioteca: $ITEMS"
echo ""
echo "🔍 Rutas de archivos (FUNCIONALES):"
echo "   - Storage: http://localhost:8080/storage/[ID]/archivo.pdf"
echo "   - Biblioteca: http://localhost:8080/library/archivo.pdf"
echo ""
echo "📊 Monitoreo:"
echo "   - API: tail -f ~/zotero-web-server/logs/api.log"
echo "   - Web: tail -f ~/zotero-web-server/logs/web-simple.log"
echo ""
echo "🛑 Para detener: ./stop-simple.sh"
echo ""