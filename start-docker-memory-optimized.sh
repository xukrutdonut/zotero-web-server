#!/bin/bash

echo "🚀 Iniciando Servidor Zotero Web con Docker (MEMORIA OPTIMIZADA)"
echo "==============================================================="

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env con configuración por defecto..."
    cat > .env << 'EOF'
# Variables de entorno para Zotero Web Server
HOST_BIBLIOTECA_DIR=/home/arkantu/Documentos/Zotero Biblioteca
HOST_ZOTERO_DB=/home/arkantu/Zotero/zotero.sqlite
ZOTERO_API_KEY=zotero-neuropedialab-memory-optimized-2024
EOF
    echo "✅ Archivo .env creado"
fi

echo "🏗️  Construyendo imagen Docker..."
docker build -t neuropedialab/zotero-web-server:memory-optimized .

# Detener contenedor anterior si existe
echo "🛑 Deteniendo contenedor anterior (si existe)..."
docker stop zotero-web-server-memory 2>/dev/null || true
docker rm zotero-web-server-memory 2>/dev/null || true

echo "🚀 Iniciando contenedor con optimizaciones de memoria..."
docker run -d \
    --name zotero-web-server-memory \
    --restart unless-stopped \
    -p 8080:8080 \
    -v "${HOST_BIBLIOTECA_DIR:-/home/arkantu/Documentos/Zotero Biblioteca}:/app/data/biblioteca:ro" \
    -v "${HOST_ZOTERO_DB:-/home/arkantu/Zotero/zotero.sqlite}:/app/data/zotero.sqlite:ro" \
    -v "$(pwd)/logs:/app/logs" \
    -e ZOTERO_API_KEY="${ZOTERO_API_KEY:-zotero-neuropedialab-memory-optimized-2024}" \
    neuropedialab/zotero-web-server:memory-optimized

# Esperar a que el contenedor esté listo
echo "⏳ Esperando a que el servidor esté listo..."
sleep 5

# Verificar que el servidor está funcionando
if curl -s http://localhost:8080/api/stats >/dev/null 2>&1; then
    echo ""
    echo "🌟 ¡Servidor Zotero iniciado con éxito!"
    echo "🌐 Accede a: http://localhost:8080"
    echo "📊 API Stats: http://localhost:8080/api/stats"
    echo ""
    echo "📋 Comandos útiles:"
    echo "   Ver logs:     docker logs -f zotero-web-server-memory"
    echo "   Detener:      docker stop zotero-web-server-memory"
    echo "   Reiniciar:    docker restart zotero-web-server-memory"
    echo "   Estado:       docker ps --filter name=zotero-web-server-memory"
else
    echo "❌ Error: El servidor no responde. Revisa los logs:"
    echo "   docker logs zotero-web-server-memory"
fi