#!/bin/bash

echo "🚀 Iniciando servidor web Zotero..."

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Instalando..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Verificar que nginx está disponible
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx no está instalado. Instalando..."
    sudo apt update
    sudo apt install -y nginx
fi

# Detener servicios existentes
echo "🛑 Deteniendo servicios existentes..."
sudo systemctl stop nginx 2>/dev/null || true
pkill -f "node.*server.js" 2>/dev/null || true

# Crear directorio de logs
mkdir -p ~/zotero-web-server/logs

# Iniciar la API en segundo plano
echo "📡 Iniciando API de Zotero..."
cd ~/zotero-web-server/api
ZOTERO_DATA_DIR="/home/arkantu/Zotero" nohup node server.js > ../logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > ../api.pid

sleep 3

# Verificar que la API está funcionando
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ API iniciada correctamente en puerto 3000"
else
    echo "❌ Error iniciando API"
    exit 1
fi

# Configurar Nginx
echo "🌐 Configurando Nginx..."
sudo cp ~/zotero-web-server/nginx.conf /etc/nginx/sites-available/zotero
sudo ln -sf /etc/nginx/sites-available/zotero /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Actualizar configuración de Nginx para rutas locales
sudo sed -i 's|/usr/share/nginx/html|/home/arkantu/zotero-web-server/web|g' /etc/nginx/sites-available/zotero
sudo sed -i 's|/usr/share/nginx/html/storage/|/home/arkantu/Zotero/|g' /etc/nginx/sites-available/zotero

# Dar permisos a Nginx para acceder a los directorios
sudo usermod -a -G arkantu www-data
chmod 755 /home/arkantu
chmod -R 755 ~/zotero-web-server/web
chmod -R 755 ~/Zotero

# Iniciar Nginx
echo "🚀 Iniciando Nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

if sudo systemctl is-active --quiet nginx; then
    echo "✅ Nginx iniciado correctamente"
else
    echo "❌ Error iniciando Nginx"
    sudo systemctl status nginx
    exit 1
fi

echo ""
echo "🎉 ¡Servidor Zotero web instalado correctamente!"
echo ""
echo "📍 Accede a tu biblioteca en:"
echo "   - Local: http://localhost"
echo "   - Red local: http://$(hostname -I | awk '{print $1}')"
echo "   - Dominio: http://zotero.neuropedialab.org"
echo ""
echo "📊 Monitoreo:"
echo "   - API Health: http://localhost:3000/health"
echo "   - Logs API: tail -f ~/zotero-web-server/logs/api.log"
echo "   - Logs Nginx: sudo tail -f /var/log/nginx/access.log"
echo ""
echo "🛑 Para detener:"
echo "   ~/zotero-web-server/stop.sh"
echo ""