#!/bin/bash

echo "🐳 Iniciando Servidor Zotero Web (Docker puro)"
echo "=============================================="

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor, instala Docker primero."
    exit 1
fi

# Verificar configuración
source .env 2>/dev/null || {
    echo "⚠️  Archivo .env no encontrado. Usando configuración por defecto."
    export HOST_BIBLIOTECA_DIR="/home/arkantu/Documentos/Zotero Biblioteca"
    export HOST_ZOTERO_DB="/home/arkantu/Zotero/zotero.sqlite"
    export ZOTERO_API_KEY="zotero-neuropedialab-docker-2024"
}

if [ ! -d "$HOST_BIBLIOTECA_DIR" ]; then
    echo "⚠️  Directorio de biblioteca no encontrado: $HOST_BIBLIOTECA_DIR"
fi

if [ ! -f "$HOST_ZOTERO_DB" ]; then
    echo "⚠️  Base de datos Zotero no encontrada: $HOST_ZOTERO_DB"
fi

# Crear directorios necesarios
mkdir -p logs

echo ""
echo "📋 Configuración:"
echo "   Biblioteca: $HOST_BIBLIOTECA_DIR"
echo "   Base de datos: $HOST_ZOTERO_DB"
echo "   Puerto: 8080"
echo ""

# Construir imagen Docker
echo "🔨 Construyendo imagen Docker..."
docker build -t neuropedialab/zotero-web-server:latest .

# Detener contenedor existente si existe
echo "🛑 Deteniendo contenedor previo (si existe)..."
docker stop zotero-web-server 2>/dev/null || true
docker rm zotero-web-server 2>/dev/null || true

# Crear red Docker
docker network create zotero-net 2>/dev/null || true

# Ejecutar contenedor
echo "🚀 Iniciando servidor..."
docker run -d \
    --name zotero-web-server \
    --network zotero-net \
    -p 8080:8080 \
    -e NODE_ENV=production \
    -e PORT=8080 \
    -e BIBLIOTECA_DIR=/app/data/biblioteca \
    -e ZOTERO_DB=/app/data/zotero.sqlite \
    -e ZOTERO_API_KEY="$ZOTERO_API_KEY" \
    -v "$HOST_BIBLIOTECA_DIR:/app/data/biblioteca:ro" \
    -v "$HOST_ZOTERO_DB:/app/data/zotero.sqlite:ro" \
    -v "$(pwd)/logs:/app/logs" \
    --restart unless-stopped \
    --memory=2g \
    --cpus=1.0 \
    neuropedialab/zotero-web-server:latest

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Servidor iniciado exitosamente!"
    echo "🌐 Accede en: http://localhost:8080"
    echo ""
    echo "📝 Comandos útiles:"
    echo "   Ver logs:     docker logs -f zotero-web-server"
    echo "   Detener:      docker stop zotero-web-server"
    echo "   Reiniciar:    docker restart zotero-web-server"
    echo "   Estado:       docker ps"
    echo "   Eliminar:     docker rm -f zotero-web-server"
else
    echo "❌ Error al iniciar el servidor"
    exit 1
fi