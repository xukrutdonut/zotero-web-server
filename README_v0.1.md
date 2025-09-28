# Zotero Web Server v0.1 🚀

> **Servidor web optimizado para biblioteca Zotero con navegación completa, OCR y búsqueda de texto**

## ✨ Características principales

### 🎯 **Funcionalidades completamente implementadas:**
- ✅ **Servidor optimizado para memoria** con límite 4GB
- ✅ **OCR completo** con tesseract + poppler-utils para PDFs sin texto
- ✅ **Navegación por carpetas** con panel interactivo
- ✅ **Contadores correctos** de PDFs por carpeta  
- ✅ **Apertura de documentos** sin errores 404
- ✅ **Interfaz web completamente funcional**
- ✅ **API endpoints completos**: `/api/folder-tree`, `/api/search-text`, `/api/pdfs`
- ✅ **Proyecto limpio** sin archivos innecesarios

### 📊 **Capacidades verificadas:**
- 5690 PDFs detectados en biblioteca
- Indexación progresiva con OCR automático
- Navegación por 15+ carpetas principales
- Búsqueda de texto completo en documentos indexados

## 🚀 Inicio rápido

### **Prerrequisitos**
- Docker instalado
- Biblioteca Zotero en formato local
- Base de datos Zotero (.sqlite)

### **Instalación**

1. **Clonar repositorio:**
```bash
git clone <tu-repo-url>
cd zotero-web-server
git checkout v0.1
```

2. **Iniciar servidor:**
```bash
chmod +x start-docker-memory-optimized.sh
./start-docker-memory-optimized.sh
```

3. **Acceder:**
- Interfaz web: http://localhost:8080
- API: http://localhost:8080/api/stats

## 🔧 Configuración

### **Variables de entorno (.env):**
```bash
HOST_BIBLIOTECA_DIR=/ruta/a/tu/biblioteca/zotero
HOST_ZOTERO_DB=/ruta/a/zotero.sqlite  
ZOTERO_API_KEY=tu-api-key-opcional
```

### **Docker optimizado:**
- **Memoria máxima:** 4GB
- **OCR:** Tesseract con español e inglés
- **Herramientas:** poppler-utils, imagemagick, ghostscript

## 📁 Estructura del proyecto

### **Archivos principales:**
```
├── start-docker-memory-optimized.sh    # Script de inicio principal
├── enhanced-server-memory-optimized.js # Servidor Node.js optimizado  
├── Dockerfile                          # Imagen Docker con OCR
├── web/index.html                      # Interfaz web mejorada
└── SOLUCION_MEMORIA.md                 # Documentación técnica
```

### **Scripts de utilidad:**
- `start-memory-optimized-docker.sh` - Script interno Docker
- `stop-docker-memory-optimized.sh` - Detener servidor

## 🌐 API Endpoints

### **Principales:**
- `GET /api/stats` - Estadísticas del servidor
- `GET /api/folder-tree` - Estructura de carpetas  
- `GET /api/pdfs?folder=ruta` - Archivos por carpeta
- `GET /api/search-text?query=termino` - Búsqueda de texto
- `GET /pdf/ruta/archivo.pdf` - Servir PDFs

## 🎨 Interfaz web

### **Panel de navegación:**
- 📁 Explorador de carpetas interactivo
- 📊 Contadores de PDFs por carpeta
- 🔍 Filtro de búsqueda en árbol

### **Panel principal:**  
- 📄 Lista de archivos por carpeta seleccionada
- ✅ Estado de indexación por archivo
- 🖱️ Clic para abrir PDFs directamente
- 🔍 Búsqueda de texto completo

## 🔍 Búsqueda y OCR

### **Indexación automática:**
- **Texto extraíble:** Procesamiento directo con pdf-parse
- **PDFs escaneados:** OCR automático con Tesseract  
- **Idiomas soportados:** Español + Inglés
- **Límite por PDF:** 10k caracteres (optimización memoria)

### **Búsqueda:**
- Búsqueda en texto completo de documentos indexados
- Resaltado de términos encontrados
- Contexto de resultados con snippets

## 📊 Optimizaciones de memoria

### **Gestión inteligente:**
- Map() en lugar de objetos para índices
- Garbage collection automático cada 50 archivos
- Guardado incremental cada 5 archivos indexados
- Límite de cache: 1000 entradas

### **Control de recursos:**
- Límite de memoria Node.js: 4GB
- Archivos grandes: Modal de confirmación
- File watchers deshabilitados (evita límites sistema)

## 🐳 Docker

### **Imagen optimizada:**
- Base: `node:18-alpine`  
- OCR: tesseract-ocr + data-spa + data-eng
- PDF: poppler-utils para conversión
- Imágenes: imagemagick + ghostscript
- Usuario no-root para seguridad

### **Volúmenes:**
- `/app/data/biblioteca` - Biblioteca Zotero (read-only)
- `/app/data/zotero.sqlite` - Base de datos (read-only)  
- `/app/logs` - Logs del servidor

## 🛠️ Desarrollo

### **Logs:**
```bash
docker logs -f zotero-web-server-memory
```

### **Depuración:**
```bash
docker exec -it zotero-web-server-memory /bin/sh
```

### **Reiniciar:**
```bash
docker restart zotero-web-server-memory
```

## 📝 Notas técnicas

### **Versión 0.1 incluye:**
- Limpieza completa: 27 archivos eliminados
- Optimización código: 9198 líneas eliminadas  
- Nuevas funcionalidades: 1042 líneas añadidas
- Código base estable y listo para producción

### **Problemas resueltos:**
1. ✅ Error 404 al abrir documentos
2. ✅ Panel navegación mostraba 0 archivos  
3. ✅ OCR no funcionaba (faltaban herramientas)
4. ✅ Estructura carpetas no se cargaba
5. ✅ Contadores incorrectos de PDFs

## 🌟 Estado del proyecto

**🎯 COMPLETAMENTE FUNCIONAL** - Listo para uso en producción

- **Servidor:** ✅ Operativo con 5690 PDFs detectados
- **OCR:** ✅ Procesando automáticamente PDFs sin texto  
- **Navegación:** ✅ Panel interactivo funcionando
- **APIs:** ✅ Todos los endpoints respondiendo correctamente
- **Docker:** ✅ Imagen optimizada con todas las herramientas

---

**Desarrollado por NeuropediaLab** 🧠  
*Versión 0.1 - Septiembre 2025*