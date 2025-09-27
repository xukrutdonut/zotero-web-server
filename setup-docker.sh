#!/bin/bash

# 🐳 Configuración Docker para Servidor Zotero Web
# NeuropediaLab - 2025

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🐳 Configuración Docker - Servidor Zotero Web${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}🔧 Configurando permisos de Docker...${NC}"

# Añadir usuario al grupo docker
sudo usermod -aG docker $USER

echo -e "${GREEN}✅ Usuario añadido al grupo docker${NC}"
echo -e "${YELLOW}⚠️ IMPORTANTE: Necesitas cerrar sesión y volver a entrar, o ejecutar:${NC}"
echo -e "${BLUE}newgrp docker${NC}"

echo -e "\n${BLUE}📋 Para dockerizar tu aplicación después de configurar permisos:${NC}"
echo -e "\n${GREEN}1. Construir imagen:${NC}"
echo -e "   docker build -t neuropedialab/zotero-web-server:latest ."

echo -e "\n${GREEN}2. Ejecutar contenedor:${NC}"
echo -e '   docker run -d \\'
echo -e '     --name zotero-web-server \\'
echo -e '     --restart unless-stopped \\'
echo -e '     -p 8080:8080 \\'
echo -e '     -v "/home/arkantu/Documentos/Zotero Biblioteca:/app/data/biblioteca:ro" \\'
echo -e '     -v "/home/arkantu/Zotero/zotero.sqlite:/app/data/zotero.sqlite:ro" \\'
echo -e '     -v "$(pwd)/logs:/app/logs" \\'
echo -e '     -e NODE_ENV=production \\'
echo -e '     -e ZOTERO_API_KEY=zotero-docker-secret \\'
echo -e '     neuropedialab/zotero-web-server:latest'

echo -e "\n${GREEN}3. Ver logs:${NC}"
echo -e "   docker logs -f zotero-web-server"

echo -e "\n${GREEN}4. Parar contenedor:${NC}"
echo -e "   docker stop zotero-web-server && docker rm zotero-web-server"

echo -e "\n${BLUE}🚀 O usa el script automatizado:${NC}"
echo -e "${GREEN}   ./docker-simple.sh start${NC}"

echo -e "\n${YELLOW}📁 Archivos Docker creados:${NC}"
echo -e "  ✅ Dockerfile - Imagen optimizada"
echo -e "  ✅ docker-compose.yml - Orquestación completa"
echo -e "  ✅ .dockerignore - Archivos excluidos"
echo -e "  ✅ docker-simple.sh - Script de gestión"

echo -e "\n${PURPLE}🎯 Tu aplicación estará disponible en:${NC}"
echo -e "${GREEN}   http://localhost:8080${NC}"
echo -e "${GREEN}   http://$(hostname -I | awk '{print $1}'):8080${NC}"