#!/bin/bash

# Script para subir el proyecto a GitHub una vez creado el repositorio
# Uso: ./upload-to-github.sh [URL_DEL_REPO]

REPO_URL=${1:-"https://github.com/NeuropediaLab/zotero-web-server.git"}

echo "🚀 Subiendo Zotero Web Server v0.3.0 a GitHub"
echo "==============================================="
echo "📍 Repositorio: $REPO_URL"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Este script debe ejecutarse desde el directorio raíz del proyecto"
    exit 1
fi

# Verificar que tenemos los branches correctos
echo "📋 Verificando branches..."
git branch -v

echo ""
echo "🏷️  Verificando tags..."
git tag -l

echo ""
echo "🔗 Configurando repositorio remoto..."
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

echo ""
echo "📤 Subiendo branches a GitHub..."

# Subir branch main
echo "  └─ Subiendo main..."
git push -u origin main

# Subir branch v0.1
echo "  └─ Subiendo v0.1..."
git push -u origin v0.1

# Subir branch v0.2
echo "  └─ Subiendo v0.2..."
git push -u origin v0.2

# Subir branch v0.3 (actual)
echo "  └─ Subiendo v0.3..."
git push -u origin v0.3

echo ""
echo "🏷️  Subiendo tags..."
git push origin --tags

echo ""
echo "✅ ¡Subida completada!"
echo ""
echo "🔍 Verificación:"
echo "  • Branches remotos:"
git branch -r
echo ""
echo "  • Tags:"
git tag -l
echo ""
echo "🌐 El repositorio está disponible en:"
echo "  $REPO_URL"
echo ""
echo "📋 Branches disponibles:"
echo "  • main: Versión base"
echo "  • v0.1: Primera versión funcional"
echo "  • v0.2: OCR mejorado"
echo "  • v0.3: Persistencia de indexación ⭐ (ACTUAL)"
echo ""
echo "🎯 Para usar la versión 0.3:"
echo "  git checkout v0.3"
echo "  docker-compose up --build -d"