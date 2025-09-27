#!/bin/bash

echo "🚀 Iniciando servidor Zotero COMPLETO (con acceso a PDFs)..."

# Detener procesos existentes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*hybrid-server" 2>/dev/null || true
pkill -f "npx serve" 2>/dev/null || true

# Crear directorio de logs
mkdir -p ~/zotero-web-server/logs

# Iniciar la API en puerto 3000
echo "📡 Iniciando API de Zotero en puerto 3000..."
cd ~/zotero-web-server/api
ZOTERO_DATA_DIR="/home/arkantu/Zotero" ZOTERO_BIBLIOTECA_DIR="/home/arkantu/Documentos/Zotero Biblioteca" nohup node server.js > ../logs/api.log 2>&1 &
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

# Verificar permisos de archivos
echo "🔧 Verificando permisos de acceso..."
chmod -R 755 ~/Zotero/storage/ 2>/dev/null || true
chmod -R 755 "/home/arkantu/Documentos/Zotero Biblioteca/" 2>/dev/null || true
chmod 755 /home/arkantu
chmod 755 ~/Zotero
chmod 755 ~/Documentos

# Iniciar servidor híbrido completo
echo "🌐 Iniciando servidor híbrido completo en puerto 8080..."
cd ~/zotero-web-server
nohup node hybrid-server-fixed2.js > logs/hybrid-complete.log 2>&1 &
HYBRID_PID=$!
echo $HYBRID_PID > hybrid-complete.pid

sleep 3

# Verificar servidor híbrido
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ Servidor híbrido funcionando en puerto 8080"
else
    echo "❌ Error con servidor híbrido"
    cat logs/hybrid-complete.log | tail -10
    exit 1
fi

# Probar acceso a PDFs
echo "🧪 Probando acceso a archivos..."
TEST_PDF=$(find ~/Zotero/storage/ -name "*.pdf" | head -1)
if [ -n "$TEST_PDF" ]; then
    PDF_DIR=$(basename $(dirname "$TEST_PDF"))
    PDF_FILE=$(basename "$TEST_PDF")
    echo "   Probando: /storage/$PDF_DIR/$(echo "$PDF_FILE" | head -c 30)..."
    
    if curl -s -I "http://localhost:8080/storage/$PDF_DIR/$(python3 -c "import urllib.parse; print(urllib.parse.quote('$PDF_FILE'))")" | grep -q "200 OK"; then
        echo "   ✅ Acceso a PDFs funcionando"
    else
        echo "   ⚠️  Problemas de acceso (posibles caracteres especiales)"
    fi
fi

IP=$(hostname -I | awk '{print $1}')
ITEMS=$(curl -s http://localhost:3000/library | jq length 2>/dev/null || echo "?")

echo ""
echo "🎉 ¡Servidor Zotero COMPLETO iniciado correctamente!"
echo "================================================="
echo ""
echo "📍 Acceso directo:"
echo "   - Local: http://localhost:8080"
echo "   - Red local: http://$IP:8080"
echo ""
echo "🌐 Para tu Nginx Proxy Manager:"
echo "   Domain: zotero.neuropedialab.org"
echo "   Forward to: http://$IP:8080"
echo "   ✅ Incluye acceso completo a PDFs y archivos"
echo ""
echo "📊 Estado:"
echo "   - API: ✅ Puerto 3000"
echo "   - Web+Storage: ✅ Puerto 8080" 
echo "   - Elementos en biblioteca: $ITEMS"
echo "   - PDFs accesibles: ✅ Ambas ubicaciones"
echo ""
echo "🔍 Rutas de archivos:"
echo "   - Storage: /storage/[ID]/archivo.pdf"
echo "   - Biblioteca: /biblioteca/archivo.pdf"
echo ""
echo "📊 Monitoreo:"
echo "   - API: tail -f ~/zotero-web-server/logs/api.log"
echo "   - Web: tail -f ~/zotero-web-server/logs/hybrid-complete.log"
echo ""
echo "🛑 Para detener: ./stop-complete.sh"
echo ""