# 🐳 Docker Setup - Servidor Zotero Web

## 🚀 Inicio Rápido

### 1. Configurar Permisos Docker
```bash
# Añadir usuario al grupo docker
sudo usermod -aG docker $USER

# Aplicar cambios (elige una opción)
newgrp docker              # O reinicia la sesión
```

### 2. Construir Imagen
```bash
docker build -t neuropedialab/zotero-web-server:latest .
```

### 3. Ejecutar Contenedor
```bash
docker run -d \
  --name zotero-web-server \
  --restart unless-stopped \
  -p 8080:8080 \
  -v "/home/arkantu/Documentos/Zotero Biblioteca:/app/data/biblioteca:ro" \
  -v "/home/arkantu/Zotero/zotero.sqlite:/app/data/zotero.sqlite:ro" \
  -v "$(pwd)/logs:/app/logs" \
  -v "zotero-data:/app/data" \
  -e NODE_ENV=production \
  -e BIBLIOTECA_DIR=/app/data/biblioteca \
  -e ZOTERO_DB=/app/data/zotero.sqlite \
  -e ZOTERO_API_KEY=zotero-docker-secret-2024 \
  neuropedialab/zotero-web-server:latest
```

## 🛠️ Scripts de Gestión

### Script Automatizado
```bash
# Usar el script de gestión completo
./docker-simple.sh start    # Construir e iniciar
./docker-simple.sh status   # Ver estado
./docker-simple.sh logs     # Ver logs
./docker-simple.sh stop     # Parar servidor
```

### Con docker-compose (si está disponible)
```bash
docker-compose up -d        # Iniciar
docker-compose logs -f      # Ver logs
docker-compose down         # Parar
```

## 📊 URLs de Acceso

- **Local:** http://localhost:8080
- **Red Local:** http://192.168.0.204:8080

## 🔧 Comandos Útiles

```bash
# Ver contenedores
docker ps

# Ver logs
docker logs -f zotero-web-server

# Acceder al shell
docker exec -it zotero-web-server /bin/bash

# Parar y eliminar
docker stop zotero-web-server
docker rm zotero-web-server

# Limpiar sistema
docker system prune -f
```

## 📁 Volúmenes

- `/app/data/biblioteca` - Biblioteca Zotero (solo lectura)
- `/app/data/zotero.sqlite` - Base de datos Zotero (solo lectura)  
- `/app/logs` - Logs del servidor
- `zotero-data` - Datos persistentes (índices)

## 🔐 Configuración

### Variables de Entorno
```bash
NODE_ENV=production
PORT=8080
BIBLIOTECA_DIR=/app/data/biblioteca
ZOTERO_DB=/app/data/zotero.sqlite
ZOTERO_API_KEY=tu-api-key-secreta
```

### Archivos de Configuración
- `Dockerfile` - Imagen Docker
- `docker-compose.yml` - Orquestación completa
- `.dockerignore` - Archivos excluidos
- `docker-simple.sh` - Script de gestión

## ❓ Troubleshooting

### Error de permisos
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Puerto ocupado
```bash
sudo lsof -i :8080
docker stop $(docker ps -q --filter "publish=8080")
```

### Limpiar todo
```bash
docker stop zotero-web-server
docker rm zotero-web-server
docker rmi neuropedialab/zotero-web-server:latest
docker volume rm zotero-data
```