#!/bin/bash

echo "🔧 Instalando servidor web Zotero (sin Docker)..."
echo "================================================"

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar Node.js
if ! command_exists node; then
    echo "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js ya está instalado: $(node --version)"
fi

# Verificar npm
if ! command_exists npm; then
    echo "📦 Instalando npm..."
    sudo apt-get install -y npm
else
    echo "✅ npm ya está instalado: $(npm --version)"
fi

# Instalar dependencias si no están instaladas
cd ~/zotero-web-server/api
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias de Node.js..."
    npm install
else
    echo "✅ Dependencias de Node.js ya instaladas"
fi

echo ""
echo "🎉 ¡Instalación completada!"
echo ""
echo "🚀 Para iniciar el servidor:"
echo "   cd ~/zotero-web-server"
echo "   ./start.sh"
echo ""
echo "🛑 Para detener el servidor:"
echo "   ./stop.sh"
echo ""