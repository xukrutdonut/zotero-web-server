#!/bin/bash

# 🚀 Script de inicio rápido Docker para Servidor Zotero Web
# NeuropediaLab - 2025

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Inicio Rápido Docker - Servidor Zotero Web${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    echo -e "${YELLOW}💡 Instala Docker: https://docs.docker.com/install/${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 Preparando entorno Docker...${NC}"

# Crear directorios necesarios
mkdir -p logs data backups

# Verificar si existe configuración
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creando configuración inicial...${NC}"
    cat > .env << EOF
# Configuración Docker - Servidor Zotero Web
ZOTERO_API_KEY=zotero-neuropedialab-docker-$(date +%Y%m%d)
NODE_ENV=production
PORT=8080

# Rutas del host (ajusta según tu configuración)
HOST_BIBLIOTECA_DIR=/home/arkantu/Documentos/Zotero Biblioteca
HOST_ZOTERO_DB=/home/arkantu/Zotero/zotero.sqlite
HOST_DATA_DIR=./data
EOF
    echo -e "${GREEN}✅ Archivo .env creado${NC}"
fi

echo -e "\n${BLUE}🏗️ Construyendo imagen Docker...${NC}"
docker compose build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Imagen construida exitosamente${NC}"
    
    echo -e "\n${BLUE}🚀 Iniciando servidor...${NC}"
    docker compose up -d
    
    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}🎉 ¡Servidor Zotero Web Docker iniciado exitosamente!${NC}"
        echo -e "\n${BLUE}📊 Información de acceso:${NC}"
        echo -e "${GREEN}🌐 URL Local: http://localhost:8080${NC}"
        echo -e "${GREEN}🔗 URL Red: http://$(hostname -I | awk '{print $1}'):8080${NC}"
        echo -e "\n${BLUE}🛠️ Comandos útiles:${NC}"
        echo -e "  docker compose logs -f     - Ver logs"
        echo -e "  docker compose down        - Parar servidor"
        echo -e "  ./docker-manage.sh status  - Ver estado completo"
        echo -e "  ./docker-manage.sh shell   - Acceder al contenedor"
        
        # Mostrar estado inicial
        sleep 3
        echo -e "\n${BLUE}📈 Estado inicial:${NC}"
        curl -s http://localhost:8080/api/stats | jq . 2>/dev/null || echo "Servidor iniciando..."
    else
        echo -e "${RED}❌ Error iniciando el servidor${NC}"
    fi
else
    echo -e "${RED}❌ Error construyendo la imagen${NC}"
fi