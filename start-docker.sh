#!/bin/bash

echo "🐳 Iniciando Servidor Zotero Web con Docker"
echo "========================================="

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor, instala Docker primero."
    exit 1
fi

# Verificar docker-compose (nueva y vieja sintaxis)
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "❌ docker-compose no está disponible. Por favor, instala docker-compose."
    exit 1
fi

echo "🔧 Usando: $COMPOSE_CMD"

# Verificar que los archivos necesarios existen
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado. Creando uno por defecto..."
    cat > .env << 'EOL'
# Directorio donde tienes tu biblioteca de Zotero
HOST_BIBLIOTECA_DIR=/home/arkantu/Documentos/Zotero Biblioteca

# Archivo de base de datos de Zotero
HOST_ZOTERO_DB=/home/arkantu/Zotero/zotero.sqlite

# Clave API de Zotero (opcional)
ZOTERO_API_KEY=zotero-neuropedialab-docker-2024
EOL
fi

# Verificar que los directorios de Zotero existen
source .env
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

# Construir y ejecutar con docker compose
echo "🔨 Construyendo imagen Docker..."
$COMPOSE_CMD build

echo "🚀 Iniciando servidor..."
$COMPOSE_CMD up -d

echo ""
echo "✅ Servidor iniciado exitosamente!"
echo "🌐 Accede en: http://localhost:8080"
echo ""
echo "📝 Comandos útiles:"
echo "   Ver logs:     $COMPOSE_CMD logs -f"
echo "   Detener:      $COMPOSE_CMD down"
echo "   Reiniciar:    $COMPOSE_CMD restart"
echo "   Estado:       $COMPOSE_CMD ps"