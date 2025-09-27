#!/bin/bash

# Script para gestión completa del servidor Zotero con PM2

echo "🚀 Gestor del Servidor Zotero - Versión de Producción"
echo "=================================================="

# Función para mostrar el estado
show_status() {
    echo "📊 Estado actual del servidor:"
    pm2 list
    echo ""
    echo "🌐 URLs de acceso:"
    echo "  Local: http://localhost:8080"
    echo "  Público: https://zotero.neuropedialab.org"
    echo ""
    echo "🔐 API para ChatGPT:"
    echo "  URL: http://localhost:8080/api/hidden/bibliography"
    echo "  Header: X-API-Key: zotero-secret-api-2024"
    echo "  O query param: ?api_key=zotero-secret-api-2024"
}

# Función para iniciar el servidor
start_server() {
    echo "🔄 Iniciando servidor Zotero..."
    
    # Crear directorio de logs
    mkdir -p logs
    
    # Detener cualquier proceso previo
    pm2 delete zotero-server 2>/dev/null || true
    
    # Iniciar con PM2
    pm2 start ecosystem.config.json
    
    # Guardar configuración PM2
    pm2 save
    
    echo "✅ Servidor iniciado con PM2"
    sleep 2
    show_status
}

# Función para detener el servidor
stop_server() {
    echo "⏹️ Deteniendo servidor Zotero..."
    pm2 stop zotero-server
    pm2 delete zotero-server
    echo "✅ Servidor detenido"
}

# Función para reiniciar el servidor
restart_server() {
    echo "🔄 Reiniciando servidor Zotero..."
    pm2 restart zotero-server
    echo "✅ Servidor reiniciado"
    show_status
}

# Función para mostrar logs
show_logs() {
    echo "📝 Mostrando logs del servidor (Ctrl+C para salir):"
    pm2 logs zotero-server
}

# Función para instalar dependencias OCR
install_ocr() {
    echo "📦 Instalando dependencias OCR..."
    echo "Necesitas permisos de administrador (sudo)"
    
    sudo apt update
    sudo apt install -y tesseract-ocr tesseract-ocr-spa poppler-utils
    
    echo "✅ Dependencias OCR instaladas"
    echo "🔄 Reiniciando servidor para aplicar cambios..."
    restart_server
}

# Función para configurar auto-inicio
setup_autostart() {
    echo "🔧 Configurando auto-inicio del servidor..."
    
    # Generar script de inicio
    pm2 startup
    pm2 save
    
    echo "✅ Auto-inicio configurado"
    echo "El servidor se iniciará automáticamente al reiniciar el sistema"
}

# Función para mostrar información de la API de ChatGPT
show_chatgpt_info() {
    echo "🤖 Información para ChatGPT"
    echo "=========================="
    echo ""
    echo "🔗 URL de la API:"
    echo "  http://localhost:8080/api/hidden/bibliography"
    echo ""
    echo "🔐 Autenticación (usar uno de estos métodos):"
    echo "  Header: X-API-Key: zotero-secret-api-2024"
    echo "  Query param: ?api_key=zotero-secret-api-2024"
    echo ""
    echo "📝 Ejemplo de uso con curl:"
    echo '  curl -H "X-API-Key: zotero-secret-api-2024" http://localhost:8080/api/hidden/bibliography'
    echo ""
    echo "📊 Respuesta JSON con:"
    echo "  - count: número de referencias"
    echo "  - items: array con las referencias bibliográficas"
    echo "  - message: mensaje de estado"
    echo ""
    echo "⚠️  Esta API está oculta y no aparece en la interfaz web"
}

# Menú principal
case "${1:-menu}" in
    "start")
        start_server
        ;;
    "stop")
        stop_server
        ;;
    "restart")
        restart_server
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "install-ocr")
        install_ocr
        ;;
    "autostart")
        setup_autostart
        ;;
    "chatgpt")
        show_chatgpt_info
        ;;
    "menu"|*)
        echo ""
        echo "Selecciona una opción:"
        echo "  ./manage-server.sh start      - Iniciar servidor"
        echo "  ./manage-server.sh stop       - Detener servidor" 
        echo "  ./manage-server.sh restart    - Reiniciar servidor"
        echo "  ./manage-server.sh status     - Ver estado"
        echo "  ./manage-server.sh logs       - Ver logs en tiempo real"
        echo "  ./manage-server.sh install-ocr - Instalar dependencias OCR"
        echo "  ./manage-server.sh autostart  - Configurar auto-inicio"
        echo "  ./manage-server.sh chatgpt    - Info API ChatGPT"
        echo ""
        ;;
esac