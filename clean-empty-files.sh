#!/bin/bash
# 🗑️ Script limpieza archivos vacíos - Zotero Web Server v0.2
# Elimina archivos PDF de 0 bytes que ralentizan indexación

BIBLIOTECA_DIR="/home/arkantu/Documentos/Zotero Biblioteca"

echo "🧹 LIMPIEZA ARCHIVOS VACÍOS - Zotero Web Server v0.2"
echo "==================================================="
echo ""
echo "📁 Directorio: $BIBLIOTECA_DIR"
echo ""

# Verificar directorio existe
if [ ! -d "$BIBLIOTECA_DIR" ]; then
    echo "❌ Error: Directorio biblioteca no encontrado"
    exit 1
fi

# Contar archivos vacíos
EMPTY_COUNT=$(find "$BIBLIOTECA_DIR" -name "*.pdf" -size 0 | wc -l)
echo "📊 Archivos vacíos encontrados: $EMPTY_COUNT"

if [ $EMPTY_COUNT -eq 0 ]; then
    echo "✅ No hay archivos vacíos que eliminar"
    exit 0
fi

echo ""
echo "📋 Lista de archivos vacíos a eliminar:"
echo "======================================"
find "$BIBLIOTECA_DIR" -name "*.pdf" -size 0 -printf "🗑️ %p (%s bytes)\n"

echo ""
echo "⚠️  ADVERTENCIA: Esta operación eliminará permanentemente $EMPTY_COUNT archivos vacíos"
echo "📝 Se creará backup de la lista antes de eliminar"

# Crear backup de lista
BACKUP_FILE="/tmp/archivos_vacios_eliminados_$(date +%Y%m%d_%H%M%S).txt"
find "$BIBLIOTECA_DIR" -name "*.pdf" -size 0 > "$BACKUP_FILE"
echo "💾 Backup creado: $BACKUP_FILE"

echo ""
read -p "¿Proceder con la eliminación? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    echo "🗑️ Eliminando archivos vacíos..."
    
    # Eliminar archivos vacíos
    DELETED=0
    while IFS= read -r -d '' file; do
        if [ -f "$file" ] && [ ! -s "$file" ]; then
            rm -f "$file"
            echo "✅ Eliminado: $(basename "$file")"
            ((DELETED++))
        fi
    done < <(find "$BIBLIOTECA_DIR" -name "*.pdf" -size 0 -print0)
    
    echo ""
    echo "🎉 LIMPIEZA COMPLETADA"
    echo "====================="
    echo "📊 Archivos eliminados: $DELETED"
    echo "💾 Lista guardada en: $BACKUP_FILE"
    echo ""
    echo "🚀 Beneficios esperados:"
    echo "   - ⚡ Indexación más rápida"
    echo "   - 🧠 Menos uso de memoria"  
    echo "   - 🔍 Mejor rendimiento búsqueda"
    echo "   - ✅ Sin errores OCR en archivos vacíos"
    
else
    echo "❌ Operación cancelada"
    rm -f "$BACKUP_FILE"
fi