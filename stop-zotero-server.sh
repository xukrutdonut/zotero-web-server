#!/bin/bash

# Script para parar el servidor Zotero Web

echo "🛑 Parando Servidor Zotero Web..."

# Buscar el proceso del servidor
PID=$(ps aux | grep "enhanced-server-no-watchers.js\|final-clean-server.js" | grep -v grep | awk '{print $2}')

if [ -n "$PID" ]; then
    echo "📋 Proceso encontrado: PID $PID"
    kill $PID
    sleep 2
    
    # Verificar si el proceso aún existe
    if ps -p $PID > /dev/null; then
        echo "⚠️ Forzando cierre..."
        kill -9 $PID
    fi
    
    echo "✅ Servidor parado exitosamente"
else
    echo "❓ No se encontró proceso del servidor ejecutándose"
fi

# Verificar que el puerto esté libre
if netstat -tlnp 2>/dev/null | grep -q ":8080" || ss -tlnp 2>/dev/null | grep -q ":8080"; then
    echo "⚠️ El puerto 8080 aún está en uso"
    echo "💡 Usa: sudo netstat -tlnp | grep :8080 para ver qué proceso lo está usando"
else
    echo "✅ Puerto 8080 liberado"
fi