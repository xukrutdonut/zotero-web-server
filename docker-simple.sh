#!/bin/bash

# 🐳 Script simple Docker para Servidor Zotero Web
# NeuropediaLab - 2025

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

CONTAINER_NAME="zotero-web-server"
IMAGE_NAME="neuropedialab/zotero-web-server:latest"

show_header() {
    echo -e "${BLUE}"
    echo "┌─────────────────────────────────────────────┐"
    echo "│  🐳 Docker Simple - Servidor Zotero Web    │"
    echo "│              NeuropediaLab 2025             │"
    echo "└─────────────────────────────────────────────┘"
    echo -e "${NC}"
}

show_help() {
    echo -e "${YELLOW}📋 Comandos disponibles:${NC}"
    echo "  build    - 🏗️  Construir imagen Docker"
    echo "  start    - 🚀 Iniciar servidor"
    echo "  stop     - 🛑 Parar servidor"
    echo "  restart  - 🔄 Reiniciar servidor"
    echo "  logs     - 📋 Ver logs"
    echo "  shell    - 💻 Acceder al shell"
    echo "  status   - 📊 Ver estado"
    echo "  clean    - 🧹 Limpiar contenedor"
    echo "  help     - ❓ Mostrar ayuda"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Error: Docker no está instalado${NC}"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Error: Docker no está ejecutándose${NC}"
        echo -e "${YELLOW}💡 Ejecuta: sudo systemctl start docker${NC}"
        exit 1
    fi
}

build_image() {
    echo -e "${BLUE}🏗️ Construyendo imagen Docker...${NC}"
    
    docker build -t $IMAGE_NAME . --no-cache
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Imagen construida exitosamente${NC}"
        docker images | grep neuropedialab/zotero-web-server
    else
        echo -e "${RED}❌ Error construyendo la imagen${NC}"
        exit 1
    fi
}

start_server() {
    echo -e "${BLUE}🚀 Iniciando Servidor Zotero Web...${NC}"
    
    # Parar contenedor existente si está ejecutándose
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    
    # Crear directorios necesarios
    mkdir -p logs data
    
    # Iniciar contenedor
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -p 8080:8080 \
        -v "/home/arkantu/Documentos/Zotero Biblioteca:/app/data/biblioteca:ro" \
        -v "/home/arkantu/Zotero/zotero.sqlite:/app/data/zotero.sqlite:ro" \
        -v "$(pwd)/logs:/app/logs" \
        -v "zotero-data:/app/data" \
        -e NODE_ENV=production \
        -e PORT=8080 \
        -e BIBLIOTECA_DIR=/app/data/biblioteca \
        -e ZOTERO_DB=/app/data/zotero.sqlite \
        -e ZOTERO_API_KEY=zotero-neuropedialab-docker-$(date +%Y%m%d) \
        $IMAGE_NAME
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Servidor iniciado exitosamente${NC}"
        
        # Obtener IP local
        LOCAL_IP=$(hostname -I | awk '{print $1}')
        
        echo -e "\n${CYAN}🌐 URLs de acceso:${NC}"
        echo -e "${GREEN}  Local: http://localhost:8080${NC}"
        echo -e "${GREEN}  Red:   http://$LOCAL_IP:8080${NC}"
        
        echo -e "\n${PURPLE}💡 Comandos útiles:${NC}"
        echo -e "  ./docker-simple.sh logs    - Ver logs"
        echo -e "  ./docker-simple.sh status  - Ver estado"
        echo -e "  ./docker-simple.sh shell   - Acceder al contenedor"
        
        # Esperar un poco y mostrar estado
        echo -e "\n${BLUE}⏳ Esperando que el servidor inicie...${NC}"
        sleep 5
        
        if curl -s http://localhost:8080/api/stats > /dev/null; then
            echo -e "${GREEN}🎉 ¡Servidor funcionando correctamente!${NC}"
        else
            echo -e "${YELLOW}⚠️ Servidor iniciando, puede tardar unos segundos...${NC}"
        fi
        
    else
        echo -e "${RED}❌ Error iniciando el servidor${NC}"
        exit 1
    fi
}

stop_server() {
    echo -e "${YELLOW}🛑 Parando Servidor Zotero Web...${NC}"
    
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Servidor parado exitosamente${NC}"
    else
        echo -e "${RED}❌ Error parando el servidor${NC}"
    fi
}

restart_server() {
    echo -e "${BLUE}🔄 Reiniciando Servidor Zotero Web...${NC}"
    stop_server
    sleep 2
    start_server
}

show_logs() {
    echo -e "${BLUE}📋 Mostrando logs del contenedor...${NC}"
    echo -e "${YELLOW}💡 Presiona Ctrl+C para salir${NC}"
    
    docker logs -f $CONTAINER_NAME
}

enter_shell() {
    echo -e "${BLUE}💻 Accediendo al shell del contenedor...${NC}"
    
    if ! docker ps | grep -q $CONTAINER_NAME; then
        echo -e "${RED}❌ Error: El contenedor no está ejecutándose${NC}"
        echo -e "${YELLOW}💡 Ejecuta: ./docker-simple.sh start${NC}"
        exit 1
    fi
    
    docker exec -it $CONTAINER_NAME /bin/bash
}

show_status() {
    echo -e "${BLUE}📊 Estado del Servidor Zotero Web:${NC}\n"
    
    if docker ps | grep -q $CONTAINER_NAME; then
        echo -e "${GREEN}✅ Contenedor: EJECUTÁNDOSE${NC}"
        
        # Información del contenedor
        CONTAINER_INFO=$(docker inspect $CONTAINER_NAME --format '{{.State.Status}} - {{.NetworkSettings.IPAddress}}' 2>/dev/null)
        echo -e "${CYAN}📋 Info: $CONTAINER_INFO${NC}"
        
        # Test de conectividad
        if curl -s http://localhost:8080/api/stats > /dev/null; then
            echo -e "${GREEN}🌐 Servidor Web: FUNCIONANDO${NC}"
            
            # Estadísticas básicas
            STATS=$(curl -s http://localhost:8080/api/stats 2>/dev/null)
            if [ $? -eq 0 ] && [ "$STATS" != "" ]; then
                echo -e "${PURPLE}📊 API: Respondiendo correctamente${NC}"
            fi
        else
            echo -e "${RED}❌ Servidor Web: NO RESPONDE${NC}"
        fi
    else
        echo -e "${RED}❌ Contenedor: PARADO${NC}"
    fi
    
    # Uso de recursos
    echo -e "\n${BLUE}📈 Recursos:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $CONTAINER_NAME 2>/dev/null || echo -e "${YELLOW}⚠️ Contenedor no ejecutándose${NC}"
}

clean_container() {
    echo -e "${YELLOW}🧹 Limpiando contenedor e imagen...${NC}"
    
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    docker rmi $IMAGE_NAME 2>/dev/null || true
    docker volume rm zotero-data 2>/dev/null || true
    docker system prune -f
    
    echo -e "${GREEN}✅ Limpieza completada${NC}"
}

# Script principal
main() {
    show_header
    check_docker
    
    case "${1:-help}" in
        "build")
            build_image
            ;;
        "start")
            # Construir imagen si no existe
            if ! docker image inspect $IMAGE_NAME &> /dev/null; then
                echo -e "${YELLOW}⚠️ Imagen no encontrada, construyendo...${NC}"
                build_image
            fi
            start_server
            ;;
        "stop")
            stop_server
            ;;
        "restart")
            restart_server
            ;;
        "logs")
            show_logs
            ;;
        "shell")
            enter_shell
            ;;
        "status")
            show_status
            ;;
        "clean")
            clean_container
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Ejecutar función principal
main "$@"