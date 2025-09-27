#!/bin/bash

echo "🛑 Deteniendo Servidor Zotero Web"
echo "================================"

docker stop zotero-web-server 2>/dev/null
docker rm zotero-web-server 2>/dev/null

echo "✅ Servidor detenido y eliminado"