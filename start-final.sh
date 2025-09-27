#!/bin/bash

# Script para iniciar el servidor Zotero final
# Este servidor incluye todas las funcionalidades corregidas

echo "🚀 Iniciando servidor Zotero final..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Instala Node.js primero."
    exit 1
fi

# Verificar dependencias del sistema para OCR
echo "📋 Verificando dependencias del sistema..."
MISSING_DEPS=""

if ! command -v pdftotext &> /dev/null; then
    MISSING_DEPS="$MISSING_DEPS poppler-utils"
fi

if ! command -v tesseract &> /dev/null; then
    MISSING_DEPS="$MISSING_DEPS tesseract-ocr"
fi

if ! command -v pdftoppm &> /dev/null; then
    MISSING_DEPS="$MISSING_DEPS poppler-utils"
fi

if [ ! -z "$MISSING_DEPS" ]; then
    echo "⚠️  Faltan dependencias del sistema para OCR:"
    echo "   Ejecuta: sudo apt update && sudo apt install$MISSING_DEPS tesseract-ocr-spa"
    echo "   El servidor funcionará, pero sin capacidad de OCR."
fi

# Verificar directorios de Zotero
ZOTERO_DIR="/home/arkantu/Zotero"
BIBLIOTECA_DIR="/home/arkantu/Documentos/Zotero Biblioteca"

echo "📁 Verificando directorios..."
if [ ! -d "$ZOTERO_DIR" ]; then
    echo "❌ No se encuentra el directorio de Zotero: $ZOTERO_DIR"
    exit 1
fi

if [ ! -d "$BIBLIOTECA_DIR" ]; then
    echo "❌ No se encuentra el directorio de biblioteca: $BIBLIOTECA_DIR"
    echo "   Verifica que hayas configurado Zotero para usar esta carpeta."
    exit 1
fi

echo "✅ Directorios verificados"

# Instalar dependencias de Node.js si es necesario
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias de Node.js..."
    npm install
fi

# Limpiar procesos previos
echo "🧹 Limpiando procesos previos..."
pkill -f "final-server.js" 2>/dev/null || true
pkill -f "node.*3002" 2>/dev/null || true

# Crear directorio de logs si no existe
mkdir -p logs

echo "🌐 Iniciando servidor final en puerto 8080..."
echo "📍 Acceso local: http://localhost:8080"
echo "📍 Acceso remoto: http://$(hostname -I | awk '{print $1}'):8080"
echo "🌍 Acceso público: https://zotero.neuropedialab.org"
echo ""
echo "📝 Para ver los logs en tiempo real:"
echo "   tail -f logs/final-server.log"
echo ""
echo "🛑 Para detener el servidor:"
echo "   ./stop-final.sh"
echo ""

# Iniciar el servidor
exec node final-server.js 2>&1 | tee logs/final-server.log