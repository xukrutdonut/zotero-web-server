#!/bin/bash

echo "🛑 Deteniendo Servidor Zotero Web (MEMORIA OPTIMIZADA)"
echo "====================================================="

# Detener el contenedor
echo "🔄 Deteniendo contenedor..."
docker stop zotero-web-server-memory

echo "🗑️  Eliminando contenedor..."
docker rm zotero-web-server-memory

echo "✅ Servidor Zotero detenido correctamente"
echo ""
echo "Para volver a iniciarlo, ejecuta:"
echo "  ./start-docker-memory-optimized.sh"