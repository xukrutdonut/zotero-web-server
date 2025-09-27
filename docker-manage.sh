#!/bin/bash

# Script para gestión Docker del servidor Zotero

set -e

CONTAINER_NAME="zotero-web-server"
IMAGE_NAME="zotero-server"

echo "🐳 Gestor Docker del Servidor Zotero"
echo "===================================="

# Función para construir la imagen
build_image() {
    echo "🔨 Construyendo imagen Docker..."
    docker build -t $IMAGE_NAME .
    echo "✅ Imagen construida: $IMAGE_NAME"
}

# Función para iniciar con docker-compose
start_compose() {
    echo "🚀 Iniciando con Docker Compose..."
    docker-compose up -d
    echo "✅ Contenedor iniciado"
    show_status
}

# Función para iniciar contenedor simple
start_container() {
    echo "🚀 Iniciando contenedor..."
    
    # Detener contenedor si existe
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    
    # Iniciar nuevo contenedor
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -p 8080:8080 \
        -v "/home/arkantu/Zotero:/app/zotero:ro" \
        -v "/home/arkantu/Documentos/Zotero Biblioteca:/app/biblioteca:ro" \
        -v "zotero_logs:/app/logs" \
        -v "zotero_data:/app/data" \
        -e NODE_ENV=production \
        -e ZOTERO_API_KEY=zotero-docker-secret-2024 \
        $IMAGE_NAME
    
    echo "✅ Contenedor iniciado: $CONTAINER_NAME"
    show_status
}

# Función para detener contenedor
stop_container() {
    echo "⏹️ Deteniendo contenedor..."
    docker-compose down 2>/dev/null || docker stop $CONTAINER_NAME
    echo "✅ Contenedor detenido"
}

# Función para mostrar logs
show_logs() {
    echo "📝 Logs del contenedor:"
    docker-compose logs -f zotero-server 2>/dev/null || docker logs -f $CONTAINER_NAME
}

# Función para mostrar estado
show_status() {
    echo ""
    echo "📊 Estado del contenedor:"
    docker ps | grep zotero || echo "❌ Contenedor no está corriendo"
    echo ""
    echo "🌐 URLs de acceso:"
    echo "  Local: http://localhost:8080"
    echo "  Público: https://zotero.neuropedialab.org"
    echo ""
    echo "🔐 API para ChatGPT:"
    echo "  URL: http://localhost:8080/api/hidden/bibliography"
    echo "  API Key: zotero-docker-secret-2024"
}

# Función para entrar al contenedor
shell_access() {
    echo "🔧 Accediendo al shell del contenedor..."
    docker exec -it $CONTAINER_NAME /bin/bash
}

# Función para limpiar recursos Docker
cleanup() {
    echo "🧹 Limpiando recursos Docker..."
    docker-compose down -v 2>/dev/null || true
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    docker image prune -f
    echo "✅ Limpieza completada"
}

# Menú principal
case "${1:-menu}" in
    "build")
        build_image
        ;;
    "start")
        build_image
        start_compose
        ;;
    "start-simple")
        build_image
        start_container
        ;;
    "stop")
        stop_container
        ;;
    "restart")
        stop_container
        sleep 2
        start_compose
        ;;
    "logs")
        show_logs
        ;;
    "status")
        show_status
        ;;
    "shell")
        shell_access
        ;;
    "cleanup")
        cleanup
        ;;
    "menu"|*)
        echo ""
        echo "Selecciona una opción:"
        echo "  ./docker-manage.sh build        - Construir imagen Docker"
        echo "  ./docker-manage.sh start        - Iniciar con docker-compose"
        echo "  ./docker-manage.sh start-simple - Iniciar contenedor simple"
        echo "  ./docker-manage.sh stop         - Detener contenedor"
        echo "  ./docker-manage.sh restart      - Reiniciar contenedor"
        echo "  ./docker-manage.sh logs         - Ver logs"
        echo "  ./docker-manage.sh status       - Ver estado"
        echo "  ./docker-manage.sh shell        - Acceder al shell"
        echo "  ./docker-manage.sh cleanup      - Limpiar recursos"
        echo ""
        ;;
esac