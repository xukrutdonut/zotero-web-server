#!/bin/bash

echo "🚀 Iniciando Servidor Zotero Mejorado..."

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    exit 1
fi

# Verificar dependencias del sistema para OCR
echo "🔍 Verificando dependencias del sistema..."

# Instalar poppler-utils (pdf2pnm) si no existe
if ! command -v pdf2pnm &> /dev/null; then
    echo "📦 Instalando poppler-utils..."
    sudo apt update && sudo apt install -y poppler-utils
fi

# Instalar tesseract si no existe
if ! command -v tesseract &> /dev/null; then
    echo "📦 Instalando tesseract-ocr..."
    sudo apt install -y tesseract-ocr tesseract-ocr-spa
fi

# Verificar que las rutas existen
BIBLIOTECA_DIR="/home/arkantu/Documentos/Zotero Biblioteca"
ZOTERO_DIR="/home/arkantu/Zotero"

if [ ! -d "$BIBLIOTECA_DIR" ]; then
    echo "⚠️  Advertencia: No se encuentra el directorio $BIBLIOTECA_DIR"
    echo "   Creando directorio..."
    mkdir -p "$BIBLIOTECA_DIR"
fi

if [ ! -d "$ZOTERO_DIR" ]; then
    echo "⚠️  Advertencia: No se encuentra el directorio $ZOTERO_DIR"
    echo "   Asegúrate de que Zotero esté instalado"
fi

# Instalar dependencias de Node.js
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias de Node.js..."
    npm install
fi

# Crear directorio web si no existe
mkdir -p web

# Copiar el nuevo index.html si existe el enhanced-index.html
if [ -f "web/enhanced-index.html" ]; then
    echo "🔄 Actualizando interfaz web..."
    cp web/enhanced-index.html web/index.html
fi

# Crear archivos de configuración si no existen
if [ ! -f "pdf-text-index.json" ]; then
    echo "{}" > pdf-text-index.json
fi

# Verificar permisos
echo "🔒 Verificando permisos..."
if [ ! -r "$BIBLIOTECA_DIR" ]; then
    echo "❌ Sin permisos de lectura en $BIBLIOTECA_DIR"
    exit 1
fi

if [ -f "$ZOTERO_DIR/zotero.sqlite" ] && [ ! -r "$ZOTERO_DIR/zotero.sqlite" ]; then
    echo "❌ Sin permisos de lectura en la base de datos de Zotero"
    exit 1
fi

echo "✅ Verificaciones completadas"

# Crear directorio de logs
mkdir -p logs

# Matar procesos anteriores si existen
pkill -f "node.*enhanced-server.js" 2>/dev/null || true

# Iniciar servidor
echo "🌟 Iniciando servidor en puerto 8080..."
echo "📁 Biblioteca: $BIBLIOTECA_DIR"
echo "🗄️  Zotero: $ZOTERO_DIR"
echo "🌐 URL: http://localhost:8080"
echo ""
echo "Para detener el servidor: Ctrl+C o ejecuta ./stop-enhanced.sh"
echo ""

# Ejecutar con logging
node enhanced-server.js 2>&1 | tee logs/enhanced-server.log