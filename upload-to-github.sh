#!/bin/bash

# 🚀 Script para subir zotero-web-server a GitHub
# Ejecutar después de crear el repositorio en GitHub

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📚 Subiendo Servidor Zotero Web a GitHub...${NC}\n"

# Verificar que estamos en un repositorio Git
if [ ! -d .git ]; then
    echo -e "${RED}❌ Error: Este directorio no es un repositorio Git${NC}"
    echo -e "${YELLOW}💡 Ejecuta 'git init' primero${NC}"
    exit 1
fi

# Pedir el nombre de usuario de GitHub
echo -e "${YELLOW}🔑 Ingresa tu nombre de usuario de GitHub:${NC}"
read -p "Usuario GitHub: " GITHUB_USER

if [ -z "$GITHUB_USER" ]; then
    echo -e "${RED}❌ Error: Debes proporcionar un nombre de usuario${NC}"
    exit 1
fi

# Configurar el remote origin
echo -e "\n${BLUE}🔗 Configurando remote origin...${NC}"
git remote add origin https://github.com/$GITHUB_USER/zotero-web-server.git

# Verificar si el remote se añadió correctamente
if git remote -v | grep -q origin; then
    echo -e "${GREEN}✅ Remote origin configurado correctamente${NC}"
else
    echo -e "${RED}❌ Error configurando remote origin${NC}"
    exit 1
fi

# Subir el repositorio
echo -e "\n${BLUE}📤 Subiendo archivos a GitHub...${NC}"
git push -u origin main

# Verificar si el push fue exitoso
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ¡Éxito! Tu aplicación zotero-web-server está ahora en GitHub${NC}"
    echo -e "${GREEN}🌐 URL: https://github.com/$GITHUB_USER/zotero-web-server${NC}"
    echo -e "\n${BLUE}📋 Próximos pasos:${NC}"
    echo -e "  • Configura GitHub Actions para CI/CD"
    echo -e "  • Añade un LICENSE file"
    echo -e "  • Configura GitHub Pages si lo deseas"
    echo -e "  • Invita colaboradores si es necesario"
else
    echo -e "\n${RED}❌ Error al subir archivos a GitHub${NC}"
    echo -e "${YELLOW}💡 Verifica que:${NC}"
    echo -e "  • Hayas creado el repositorio en GitHub"
    echo -e "  • Tengas permisos de escritura"
    echo -e "  • Tu conexión a internet funcione"
    echo -e "  • Tu nombre de usuario sea correcto"
fi