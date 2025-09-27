# Configuración del Servidor Zotero Mejorado

## Rutas importantes
- **Biblioteca de documentos:** `/home/arkantu/Documentos/Zotero Biblioteca`
- **Storage Zotero:** `/home/arkantu/Zotero/storage`
- **Base de datos Zotero:** `/home/arkantu/Zotero/zotero.sqlite`
- **Puerto del servidor:** `8080`

## Funcionalidades implementadas

### ✅ Navegación mejorada
- Árbol de carpetas navegable con desplegables
- Respeta la estructura de `/Documentos/Zotero Biblioteca`
- Enlaces directos a PDFs sin páginas intermedias
- Filtrado en tiempo real de carpetas y archivos

### ✅ Estadísticas compactas en header
- Total de PDFs
- PDFs indexados
- Última sincronización
- Estado de sincronización en tiempo real

### ✅ Indexación inteligente de PDFs
- Extracción de texto automática
- OCR para PDFs escaneados (requiere tesseract)
- Procesamiento en segundo plano con límite de recursos
- Cola de indexación con progreso visible

### ✅ Búsqueda avanzada
- Búsqueda por contenido de texto en PDFs
- Resultados con contexto y relevancia
- Búsqueda instantánea en árbol de carpetas

### ✅ Sincronización en tiempo real
- Detecta cambios en el filesystem automáticamente
- Actualización instantánea de la interfaz
- WebSocket para comunicación bidireccional

### ✅ API para ChatGPT
- Endpoint `/api/bibliography` con referencias bibliográficas
- Información completa de metadatos desde Zotero
- Estado de indexación por documento

## Dependencias del sistema requeridas

```bash
# Herramientas PDF
sudo apt install poppler-utils

# OCR (opcional pero recomendado)
sudo apt install tesseract-ocr tesseract-ocr-spa

# Node.js (ya instalado)
```

## Uso

### Iniciar servidor mejorado:
```bash
cd /home/arkantu/zotero-web-server
./start-enhanced.sh
```

### Detener servidor:
```bash
./stop-enhanced.sh
```

### Acceso web:
- **Local:** http://localhost:8080
- **Dominio configurado:** https://zotero.neuropedialab.org

## API Endpoints disponibles

- `GET /api/folder-tree` - Estructura de carpetas y archivos
- `GET /api/search-text?query=texto` - Búsqueda en contenido
- `GET /api/bibliography` - Referencias bibliográficas completas
- `GET /api/stats` - Estadísticas del sistema
- `GET /biblioteca/{ruta}` - Acceso directo a PDFs

## Características técnicas

### Optimización de recursos
- Indexación limitada a 1 archivo por segundo
- Pausas entre procesamientos para no bloquear sistema
- Guardado incremental del índice cada 10 archivos
- Buffer de 10MB para OCR

### Sincronización
- Vigilancia de archivos con `chokidar`
- Eventos WebSocket para actualizaciones en tiempo real
- Detección automática de archivos añadidos/eliminados

### Interfaz mejorada
- Diseño responsive y moderno
- Tres pestañas principales: Navegación, Búsqueda, Bibliografía
- Indicadores visuales de estado de indexación
- Scroll en árboles largos de carpetas

## Notas importantes

1. **Primera ejecución:** El sistema indexará todos los PDFs existentes. Esto puede tardar según la cantidad de documentos.

2. **Memoria:** El índice de texto se mantiene en memoria para búsquedas rápidas y se guarda en `pdf-text-index.json`.

3. **OCR:** Solo se ejecuta si la extracción directa de texto falla. Requiere más recursos.

4. **Base de datos:** Se accede en modo solo lectura a la base de datos de Zotero.

5. **Proxy:** Ya configurado con tu proxy npm para el dominio zotero.neuropedialab.org.