#!/bin/bash

echo "🐳 Iniciando Servidor Zotero Web con Docker (Método Simple)"
echo "==========================================================="

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor, instala Docker primero."
    exit 1
fi

echo "🔧 Usando: docker directamente"

# Verificar que los archivos necesarios existen
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado. Creando uno por defecto..."
    cat > .env << 'EOL'
# Directorio donde tienes tu biblioteca de Zotero
HOST_BIBLIOTECA_DIR="/home/arkantu/Documentos/Zotero Biblioteca"

# Archivo de base de datos de Zotero
HOST_ZOTERO_DB="/home/arkantu/Zotero/zotero.sqlite"

# Clave API de Zotero (opcional)
ZOTERO_API_KEY=zotero-neuropedialab-docker-2024

# Puerto del servidor
PORT=8080

# Configuración de Node.js
NODE_ENV=production
EOL
fi

# Cargar variables de entorno
source .env

# Verificar que los directorios de Zotero existen
if [ ! -d "$HOST_BIBLIOTECA_DIR" ]; then
    echo "⚠️  Directorio de biblioteca no encontrado: $HOST_BIBLIOTECA_DIR"
    echo "   Por favor, ajusta HOST_BIBLIOTECA_DIR en el archivo .env"
fi

if [ ! -f "$HOST_ZOTERO_DB" ]; then
    echo "⚠️  Base de datos Zotero no encontrada: $HOST_ZOTERO_DB"
    echo "   Por favor, ajusta HOST_ZOTERO_DB en el archivo .env"
fi

# Crear directorios necesarios
mkdir -p logs

echo ""
echo "📋 Configuración:"
echo "   Biblioteca: $HOST_BIBLIOTECA_DIR"
echo "   Base de datos: $HOST_ZOTERO_DB"
echo "   Puerto: 8080"
echo ""

# Detener contenedor previo si existe
echo "🛑 Deteniendo contenedor previo (si existe)..."
docker stop zotero-web-server 2>/dev/null || true
docker rm zotero-web-server 2>/dev/null || true

# Construir la imagen Docker
echo "🔨 Construyendo imagen Docker..."
docker build -t neuropedialab/zotero-web-server:latest .

if [ $? -ne 0 ]; then
    echo "❌ Error al construir la imagen Docker"
    exit 1
fi

# Ejecutar el contenedor
echo "🚀 Iniciando servidor..."

# Verificar que las variables no estén vacías
if [ -z "$HOST_BIBLIOTECA_DIR" ] || [ -z "$HOST_ZOTERO_DB" ]; then
    echo "❌ Error: Las variables HOST_BIBLIOTECA_DIR y HOST_ZOTERO_DB deben estar definidas en .env"
    exit 1
fi

docker run -d \
  --name zotero-web-server \
  --restart unless-stopped \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e BIBLIOTECA_DIR=/app/data/biblioteca \
  -e ZOTERO_DB=/app/data/zotero.sqlite \
  -e ZOTERO_API_KEY="${ZOTERO_API_KEY:-zotero-neuropedialab-docker-2024}" \
  -v "$HOST_BIBLIOTECA_DIR:/app/data/biblioteca:ro" \
  -v "$HOST_ZOTERO_DB:/app/data/zotero.sqlite:ro" \
  -v "$(pwd)/logs:/app/logs" \
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
    echo ""
    echo "📋 Ver logs actuales:"
    docker logs zotero-web-server | tail -10
else
    echo "❌ Error al iniciar el servidor"
    exit 1
fi