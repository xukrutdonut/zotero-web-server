#!/bin/bash

# Script para detener el servidor Zotero final

echo "🛑 Deteniendo servidor Zotero final..."

# Detener procesos
pkill -f "final-server.js" 2>/dev/null && echo "✅ Servidor principal detenido"
pkill -f "node.*3002" 2>/dev/null && echo "✅ WebSocket detenido"

echo "🧹 Limpieza completada"