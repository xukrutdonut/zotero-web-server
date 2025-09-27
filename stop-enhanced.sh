#!/bin/bash

echo "⏹️ Deteniendo Servidor Zotero Mejorado..."

# Matar todos los procesos del servidor mejorado
pkill -f "node.*enhanced-server.js" 2>/dev/null

# Esperar un momento
sleep 2

# Verificar que se detuvo
if pgrep -f "node.*enhanced-server.js" > /dev/null; then
    echo "⚠️  Forzando cierre del servidor..."
    pkill -9 -f "node.*enhanced-server.js"
else
    echo "✅ Servidor detenido exitosamente"
fi

# Mostrar estadísticas finales si existe el log
if [ -f "logs/enhanced-server.log" ]; then
    echo ""
    echo "📊 Últimas líneas del log:"
    tail -5 logs/enhanced-server.log
fi