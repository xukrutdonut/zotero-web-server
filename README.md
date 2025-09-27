# 📚 Servidor Zotero Web - NeuropediaLab

Un servidor web profesional para acceder, buscar y gestionar tu biblioteca de documentos Zotero con indexación de texto completo e inteligencia artificial.

![Version](https://img.shields.io/badge/version-2.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0-brightgreen.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🚀 Características Principales

- **📁 Navegación Intuitiva**: Interfaz web moderna para explorar tu biblioteca de documentos
- **🔍 Búsqueda Avanzada**: Búsqueda en texto completo con indexación automática de PDFs
- **⚡ Tiempo Real**: Sincronización automática y actualizaciones en vivo con WebSockets
- **🤖 APIs Ocultas**: Endpoints protegidos para integración con sistemas de IA (ChatGPT, etc.)
- **🐳 Docker Ready**: Contenedor optimizado para fácil despliegue
- **📊 Estadísticas**: Monitoreo en tiempo real del estado de indexación
- **🔒 Seguridad**: API Keys para proteger endpoints sensibles

## 📋 Requisitos

- **Node.js** >= 18.0
- **Docker** (opcional, recomendado)
- **poppler-utils** (pdftotext)
- **tesseract-ocr** (opcional, para OCR)

## 🛠️ Instalación Rápida

### Con Docker (Recomendado)

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/zotero-web-server.git
cd zotero-web-server

# Configurar variables de entorno
cp .env.example .env
nano .env  # Editar rutas según tu configuración

# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f zotero-server
```

### Instalación Manual

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/zotero-web-server.git
cd zotero-web-server

# Instalar dependencias
npm install

# Configurar variables de entorno
export BIBLIOTECA_DIR="/ruta/a/tu/biblioteca/zotero"
export ZOTERO_DB="/ruta/a/zotero/zotero.sqlite"
export ZOTERO_API_KEY="tu-api-key-secreta"

# Ejecutar servidor
node final-clean-server.js
```

## ⚙️ Configuración

### Variables de Entorno

```env
# Puerto del servidor
PORT=8080

# Rutas de datos
BIBLIOTECA_DIR=/home/usuario/Documentos/Zotero Biblioteca
ZOTERO_DB=/home/usuario/Zotero/zotero.sqlite

# API Key para servicios ocultos
ZOTERO_API_KEY=zotero-your-secret-key-here

# Entorno
NODE_ENV=production
```

## 🌐 Uso

### Interfaz Web

Accede a `http://localhost:8080` para:

- **📁 Navegar** por tu biblioteca de documentos
- **🔍 Buscar** en el contenido de los PDFs
- **📊 Ver estadísticas** de indexación en tiempo real
- **📄 Abrir documentos** directamente en el navegador

### APIs Públicas

```bash
# Obtener estructura de carpetas
curl http://localhost:8080/api/folder-tree

# Buscar en texto
curl "http://localhost:8080/api/search-text?query=neurologia&limit=10"

# Obtener estadísticas
curl http://localhost:8080/api/stats

# Acceder a PDF
curl http://localhost:8080/biblioteca/ruta/archivo.pdf
```

### APIs Ocultas (Requieren API Key)

```bash
# Header de autorización
HEADERS="-H 'X-API-Key: tu-api-key'"

# Obtener bibliografía completa
curl $HEADERS http://localhost:8080/api/hidden/bibliography

# Búsqueda avanzada con más resultados
curl $HEADERS "http://localhost:8080/api/hidden/search-full?query=texto&limit=100"

# Obtener texto completo de un archivo
curl $HEADERS "http://localhost:8080/api/hidden/file-content/ruta/archivo.pdf"

# Formato texto plano para IA
curl $HEADERS "http://localhost:8080/api/hidden/search-full?query=texto&format=text"
```

## 🤖 Integración con ChatGPT

### Configuración para ChatGPT

1. **Obtén tu API Key** del servidor (se muestra en los logs al inicio)
2. **Configura ChatGPT** con estos endpoints:

```
GET http://tu-servidor:8080/api/hidden/bibliography
GET http://tu-servidor:8080/api/hidden/search-full?query={consulta}
GET http://tu-servidor:8080/api/hidden/file-content/{ruta}
```

## 📊 Monitoreo y Logs

### Logs en Tiempo Real

```bash
# Docker
docker-compose logs -f zotero-server

# PM2
pm2 logs zotero-server

# Manual
tail -f logs/app.log
```

## 🔒 Seguridad

### Generar API Key Segura

```bash
# Método 1: OpenSSL
openssl rand -hex 32

# Método 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 👨‍⚕️ Autor

**NeuropediaLab** - Especialistas en Neurología y Tecnología

---

⭐ **¿Te gusta este proyecto?** ¡Dale una estrella en GitHub!