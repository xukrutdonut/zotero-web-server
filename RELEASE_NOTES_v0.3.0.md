# Zotero Web Server v0.3.0 - Notas de Versión

## 🎯 Objetivo Principal
Esta versión resuelve el problema crítico de **pérdida de indexación** al reiniciar el contenedor Docker, implementando persistencia completa de los datos de caché.

## 🆕 Características Nuevas

### 💾 Persistencia de Indexación
- **Problema resuelto**: La indexación de PDFs ya no se pierde al reiniciar el contenedor
- **Implementación**: Volumen Docker persistente `zotero-data` montado en `/app/data/cache`
- **Beneficio**: Los usuarios ya no necesitan re-indexar toda su biblioteca después de cada reinicio

### 🔧 Configuración Mejorada
- Nueva variable de entorno `CACHE_DIR` para configurar la ubicación del caché
- Creación automática del directorio de caché si no existe
- Logs mejorados que muestran la ubicación del caché persistente

## 📂 Cambios Técnicos

### Archivos Modificados
1. **package.json**: Versión actualizada a 0.3.0
2. **docker-compose.yml**: 
   - Variable `CACHE_DIR=/app/data/cache`
   - Etiquetas de versión actualizadas
   - Descripción actualizada del servicio
3. **enhanced-server-memory-optimized.js**:
   - Ruta del índice cambiada a `${CACHE_DIR}/pdf-text-index.json`
   - Lógica de creación automática del directorio de caché
   - Logging adicional para mostrar ubicación del caché

### Estructura de Volúmenes
```
/app/data/
├── biblioteca/     (montado desde host - solo lectura)
├── zotero.sqlite   (montado desde host - solo lectura)
└── cache/          (volumen persistente - lectura/escritura)
    └── pdf-text-index.json  (índice persistente)
```

## 🔄 Migración desde v2.0.0

### Para Usuarios Existentes
1. **Actualizar archivos**: Los cambios son automáticos
2. **Re-construcción**: `docker-compose down && docker-compose up --build`
3. **Primera ejecución**: El sistema creará automáticamente el directorio de caché
4. **Re-indexación inicial**: Solo necesaria una vez, después persiste

### Compatibilidad
- ✅ Totalmente compatible con configuraciones existentes
- ✅ No requiere cambios en archivos `.env`
- ✅ Conserva todas las funcionalidades anteriores

## 🎯 Beneficios Inmediatos

1. **⚡ Arranque más rápido**: No re-indexación completa en cada reinicio
2. **💾 Datos seguros**: El índice persiste incluso si el contenedor se elimina
3. **🔧 Mantenimiento simplificado**: Los usuarios pueden reiniciar sin preocuparse
4. **📊 Estadísticas consistentes**: Los contadores se mantienen entre sesiones

## 🧪 Verificación

Ejecuta el script de prueba incluido:
```bash
./test-v0.3.sh
```

Este script verifica que todos los cambios estén correctamente implementados.

## 📝 Próximos Pasos

- Probar la construcción: `docker-compose build`
- Iniciar el servicio: `docker-compose up -d`
- Verificar logs: `docker-compose logs -f`
- Comprobar persistencia reiniciando el contenedor

---

**Desarrollado por NeuropediaLab**  
**Fecha**: 20 de Diciembre, 2024  
**Versión**: 0.3.0