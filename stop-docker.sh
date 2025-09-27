#!/bin/bash

echo "🛑 Deteniendo Servidor Zotero Web"
echo "================================"

# Verificar docker-compose (nueva y vieja sintaxis)
if command -v docker-compose &> /dev/null; then
    docker-compose down
    echo "✅ Servidor detenido"
elif docker compose version &> /dev/null; then
    docker compose down
    echo "✅ Servidor detenido"
else
    echo "❌ docker-compose no encontrado"
    exit 1
fi