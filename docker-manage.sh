#!/bin/bash

# 🐳 Script de gestión Docker para Servidor Zotero Web
# NeuropediaLab - 2025

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variables
CONTAINER_NAME="zotero-web-server"
IMAGE_NAME="neuropedialab/zotero-web-server:latest"
COMPOSE_FILE="docker-compose.yml"

# Funciones
show_header() {
    echo -e "${BLUE}"
    echo "┌─────────────────────────────────────────────┐"
    echo "│  🐳 Gestor Docker - Servidor Zotero Web    │"
    echo "│              NeuropediaLab 2025             │"
    echo "└─────────────────────────────────────────────┘"
    echo -e "${NC}"
}

show_help() {
    echo -e "${YELLOW}📋 Comandos disponibles:${NC}"
    echo "  build    - 🏗️  Construir imagen Docker"
    echo "  start    - 🚀 Iniciar servidor en Docker"
    echo "  stop     - 🛑 Parar servidor Docker"
    echo "  restart  - 🔄 Reiniciar servidor Docker"
    echo "  logs     - 📋 Ver logs del contenedor"
    echo "  shell    - 💻 Acceder al shell del contenedor"
    echo "  status   - 📊 Ver estado del contenedor"
    echo "  clean    - 🧹 Limpiar contenedores e imágenes"
    echo "  update   - 🔄 Actualizar y reconstruir"
    echo "  backup   - 💾 Hacer backup de datos"
    echo "  help     - ❓ Mostrar esta ayuda"
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
    
    # Verificar que tenemos los archivos necesarios
    if [ ! -f "Dockerfile" ] || [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}❌ Error: Faltan archivos Docker necesarios${NC}"
        exit 1
    fi
    
    docker compose build --no-cache
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Imagen construida exitosamente${NC}"
    else
        echo -e "${RED}❌ Error construyendo la imagen${NC}"
        exit 1
    fi
}

start_server() {
    echo -e "${BLUE}🚀 Iniciando Servidor Zotero Web en Docker...${NC}"
    
    # Verificar que la imagen existe
    if ! docker image inspect $IMAGE_NAME &> /dev/null; then
        echo -e "${YELLOW}⚠️ Imagen no encontrada, construyendo...${NC}"
        build_image
    fi
    
    # Crear directorios de logs si no existen
    mkdir -p logs
    
    docker compose up -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Servidor iniciado exitosamente${NC}"
        echo -e "${CYAN}🌐 URL: http://localhost:8080${NC}"
        echo -e "${PURPLE}📋 Ver logs: ./docker-manage.sh logs${NC}"
        echo -e "${PURPLE}📊 Estado: ./docker-manage.sh status${NC}"
    else
        echo -e "${RED}❌ Error iniciando el servidor${NC}"
        exit 1
    fi
}

stop_server() {
    echo -e "${YELLOW}🛑 Parando Servidor Zotero Web...${NC}"
    
    docker compose down
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Servidor parado exitosamente${NC}"
    else
        echo -e "${RED}❌ Error parando el servidor${NC}"
        exit 1
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
    
    docker compose logs -f
}

enter_shell() {
    echo -e "${BLUE}💻 Accediendo al shell del contenedor...${NC}"
    
    if ! docker compose ps | grep -q "$CONTAINER_NAME.*Up"; then
        echo -e "${RED}❌ Error: El contenedor no está ejecutándose${NC}"
        echo -e "${YELLOW}💡 Ejecuta: ./docker-manage.sh start${NC}"
        exit 1
    fi
    
    docker compose exec zotero-server /bin/bash
}

show_status() {
    echo -e "${BLUE}📊 Estado del Servidor Zotero Web:${NC}\n"
    
    # Estado del contenedor
    if docker compose ps | grep -q "$CONTAINER_NAME.*Up"; then
        echo -e "${GREEN}✅ Contenedor: EJECUTÁNDOSE${NC}"
        
        # Obtener IP del contenedor
        CONTAINER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $CONTAINER_NAME 2>/dev/null)
        echo -e "${CYAN}🔗 IP Contenedor: $CONTAINER_IP${NC}"
        
        # Test de conectividad
        if curl -s http://localhost:8080/api/stats > /dev/null; then
            echo -e "${GREEN}🌐 Servidor Web: FUNCIONANDO${NC}"
            
            # Obtener estadísticas
            STATS=$(curl -s http://localhost:8080/api/stats)
            if [ $? -eq 0 ] && [ "$STATS" != "" ]; then
                echo -e "${PURPLE}📊 Estadísticas: $(echo $STATS | jq -r '.totalPDFs // "N/A"') PDFs encontrados${NC}" 2>/dev/null || echo -e "${PURPLE}📊 API respondiendo correctamente${NC}"
            fi
        else
            echo -e "${RED}❌ Servidor Web: NO RESPONDE${NC}"
        fi
        
    else
        echo -e "${RED}❌ Contenedor: PARADO${NC}"
    fi
    
    # Uso de recursos
    echo -e "\n${BLUE}📈 Recursos:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $CONTAINER_NAME 2>/dev/null || echo -e "${YELLOW}⚠️ Contenedor no está ejecutándose${NC}"
}

clean_docker() {
    echo -e "${YELLOW}🧹 Limpiando contenedores e imágenes Docker...${NC}"
    echo -e "${RED}⚠️ Esto eliminará el contenedor y la imagen local${NC}"
    
    read -p "¿Continuar? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose down --rmi all --volumes --remove-orphans
        docker system prune -f
        echo -e "${GREEN}✅ Limpieza completada${NC}"
    else
        echo -e "${YELLOW}❌ Limpieza cancelada${NC}"
    fi
}

update_server() {
    echo -e "${BLUE}🔄 Actualizando Servidor Zotero Web...${NC}"
    
    stop_server
    build_image
    start_server
    
    echo -e "${GREEN}✅ Servidor actualizado exitosamente${NC}"
}

backup_data() {
    echo -e "${BLUE}💾 Creando backup de datos...${NC}"
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup de logs
    if [ -d "logs" ]; then
        cp -r logs "$BACKUP_DIR/"
        echo -e "${GREEN}✅ Logs respaldados${NC}"
    fi
    
    # Backup de configuración
    cp docker-compose.yml Dockerfile .env 2>/dev/null "$BACKUP_DIR/" || true
    
    # Backup del volumen Docker (datos persistentes)
    if docker volume inspect zotero-web-server_zotero-data &>/dev/null; then
        docker run --rm -v zotero-web-server_zotero-data:/source -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/zotero-data.tar.gz -C /source .
        echo -e "${GREEN}✅ Datos del volumen respaldados${NC}"
    fi
    
    echo -e "${GREEN}📁 Backup creado en: $BACKUP_DIR${NC}"
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
            clean_docker
            ;;
        "update")
            update_server
            ;;
        "backup")
            backup_data
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Ejecutar función principal
main "$@"