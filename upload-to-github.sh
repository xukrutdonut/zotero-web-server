#!/bin/bash

echo "🚀 Script para subir Zotero Web Server a GitHub"
echo "================================================"

# Colores para mejor visualización
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar si estamos en un repositorio git
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: No estás en un repositorio Git${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Información del repositorio local:${NC}"
echo "Rama actual: $(git branch --show-current)"
echo "Último commit: $(git log --oneline -1)"
echo ""

# Verificar el estado del repositorio
echo -e "${BLUE}🔍 Verificando estado del repositorio...${NC}"
git status --porcelain

if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Hay cambios sin commitear. ¿Deseas continuar? (y/n)${NC}"
    read -r response
    if [ "$response" != "y" ]; then
        echo "Operación cancelada."
        exit 0
    fi
fi

echo ""
echo -e "${YELLOW}📝 Para subir a GitHub, necesitas:${NC}"
echo "1. Tener una cuenta de GitHub"
echo "2. Crear un repositorio nuevo en GitHub (sin inicializar con README)"
echo "3. Tener configurado Git con tu usuario y email"
echo ""

# Verificar configuración de Git
echo -e "${BLUE}🔧 Verificando configuración de Git...${NC}"
git_user=$(git config user.name)
git_email=$(git config user.email)

if [ -z "$git_user" ] || [ -z "$git_email" ]; then
    echo -e "${RED}❌ Git no está configurado con usuario y email${NC}"
    echo "Configura tu usuario con:"
    echo "  git config --global user.name 'Tu Nombre'"
    echo "  git config --global user.email 'tu.email@ejemplo.com'"
    exit 1
else
    echo -e "${GREEN}✅ Git configurado para: $git_user ($git_email)${NC}"
fi

echo ""
echo -e "${YELLOW}🔗 Ingresa la URL de tu repositorio GitHub:${NC}"
echo "Formato: https://github.com/usuario/nombre-repositorio.git"
read -r repo_url

if [ -z "$repo_url" ]; then
    echo -e "${RED}❌ URL del repositorio no puede estar vacía${NC}"
    exit 1
fi

# Validar formato de URL
if [[ ! "$repo_url" =~ ^https://github\.com/.+/.+\.git$ ]]; then
    echo -e "${RED}❌ Formato de URL inválido${NC}"
    echo "Debe ser: https://github.com/usuario/repositorio.git"
    exit 1
fi

# Agregar remote si no existe
echo -e "${BLUE}🔗 Configurando repositorio remoto...${NC}"
if git remote get-url origin >/dev/null 2>&1; then
    echo "Remote 'origin' ya existe. Actualizando URL..."
    git remote set-url origin "$repo_url"
else
    echo "Agregando remote 'origin'..."
    git remote add origin "$repo_url"
fi

echo -e "${GREEN}✅ Remote configurado: $repo_url${NC}"

# Mostrar resumen antes de subir
echo ""
echo -e "${BLUE}📊 Resumen antes de subir:${NC}"
echo "Repositorio remoto: $repo_url"
echo "Rama a subir: $(git branch --show-current)"
echo "Archivos a subir:"
git ls-files | head -10
total_files=$(git ls-files | wc -l)
echo "... y $((total_files - 10)) archivos más (total: $total_files archivos)"

echo ""
echo -e "${YELLOW}¿Confirmas que deseas subir el repositorio? (y/n)${NC}"
read -r confirm

if [ "$confirm" != "y" ]; then
    echo "Operación cancelada."
    exit 0
fi

# Subir al repositorio
echo ""
echo -e "${BLUE}🚀 Subiendo al repositorio...${NC}"

if git push -u origin main; then
    echo ""
    echo -e "${GREEN}🎉 ¡Repositorio subido exitosamente a GitHub!${NC}"
    echo ""
    echo -e "${BLUE}📋 Enlaces útiles:${NC}"
    repo_base_url="${repo_url%.git}"
    echo "🔗 Ver repositorio: $repo_base_url"
    echo "📁 Explorar código: $repo_base_url/tree/main"
    echo "📄 README: $repo_base_url/blob/main/README.md"
    echo "🐳 Docker: $repo_base_url/blob/main/docker-compose.yml"
    echo ""
    echo -e "${GREEN}✅ Tu Zotero Web Server ya está disponible en GitHub${NC}"
else
    echo ""
    echo -e "${RED}❌ Error al subir el repositorio${NC}"
    echo "Posibles soluciones:"
    echo "1. Verifica que el repositorio exista en GitHub"
    echo "2. Verifica tus credenciales de GitHub"
    echo "3. Asegúrate de tener permisos de escritura"
    echo ""
    echo "Para intentar nuevamente:"
    echo "  git push -u origin main"
    exit 1
fi