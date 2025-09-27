#!/bin/bash

echo "🧹 Script de Limpieza de Duplicados - Zotero Web Server"
echo "====================================================="

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Directorio de la biblioteca
BIBLIOTECA_DIR="${HOME}/Documentos/Zotero Biblioteca"

if [ ! -d "$BIBLIOTECA_DIR" ]; then
    echo -e "${RED}❌ Error: Directorio de biblioteca no encontrado: $BIBLIOTECA_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}📁 Analizando biblioteca: $BIBLIOTECA_DIR${NC}"
echo ""

# Función para detectar duplicados por nombre (sin extensión)
find_duplicates_by_name() {
    echo -e "${BLUE}🔍 Buscando archivos duplicados por nombre...${NC}"
    
    # Crear archivo temporal para análisis
    temp_file=$(mktemp)
    
    # Encontrar todos los PDFs y extraer nombres base
    find "$BIBLIOTECA_DIR" -name "*.pdf" | while read -r file; do
        basename_no_ext=$(basename "$file" .pdf)
        # Remover sufijos como " 1", " 2", " 3", etc.
        clean_name=$(echo "$basename_no_ext" | sed 's/ [0-9]\+$//')
        echo "$clean_name|$file" >> "$temp_file"
    done
    
    # Encontrar duplicados
    echo -e "${YELLOW}📋 Duplicados encontrados:${NC}"
    duplicates_found=0
    
    # Agrupar por nombre limpio
    sort "$temp_file" | while IFS='|' read -r clean_name full_path; do
        count=$(grep -c "^$clean_name|" "$temp_file")
        if [ "$count" -gt 1 ]; then
            if [ "$duplicates_found" -eq 0 ]; then
                echo ""
                echo -e "${RED}🔴 Grupo de duplicados para: $clean_name${NC}"
                duplicates_found=$((duplicates_found + 1))
            fi
            echo "  - $(basename "$full_path")"
        fi
    done
    
    rm -f "$temp_file"
}

# Función para limpiar duplicados automáticamente
clean_duplicates() {
    echo -e "${BLUE}🧹 Iniciando limpieza automática de duplicados...${NC}"
    
    # Crear backup antes de limpiar
    backup_dir="${BIBLIOTECA_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}💾 Creando backup en: $backup_dir${NC}"
    
    if ! cp -r "$BIBLIOTECA_DIR" "$backup_dir"; then
        echo -e "${RED}❌ Error al crear backup. Abortando limpieza.${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Backup creado exitosamente${NC}"
    echo ""
    
    # Archivo temporal para tracking
    temp_groups=$(mktemp)
    temp_analysis=$(mktemp)
    
    # Analizar todos los archivos
    find "$BIBLIOTECA_DIR" -name "*.pdf" | while read -r file; do
        # Obtener información del archivo
        basename_file=$(basename "$file")
        basename_no_ext=$(basename "$file" .pdf)
        
        # Limpiar nombre (remover sufijos numéricos)
        clean_name=$(echo "$basename_no_ext" | sed 's/ [0-9]\+$//')
        
        # Obtener tamaño del archivo
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        
        echo "$clean_name|$file|$size|$basename_file" >> "$temp_analysis"
    done
    
    echo -e "${BLUE}🔄 Procesando grupos de duplicados...${NC}"
    
    # Procesar grupos y mantener el archivo más grande
    cleaned_count=0
    sort "$temp_analysis" | while IFS='|' read -r clean_name full_path size basename_file; do
        # Contar archivos con el mismo nombre limpio
        group_files=$(grep "^$clean_name|" "$temp_analysis")
        group_count=$(echo "$group_files" | wc -l)
        
        if [ "$group_count" -gt 1 ]; then
            echo ""
            echo -e "${YELLOW}📁 Grupo: $clean_name (${group_count} archivos)${NC}"
            
            # Encontrar el archivo más grande del grupo
            largest_file=""
            largest_size=0
            
            echo "$group_files" | while IFS='|' read -r gname gpath gsize gbasename; do
                echo "  - $gbasename ($(numfmt --to=iec $gsize))"
                
                if [ "$gsize" -gt "$largest_size" ]; then
                    largest_size=$gsize
                    largest_file=$gpath
                fi
            done
            
            # Eliminar archivos duplicados (mantener el más grande)
            echo "$group_files" | while IFS='|' read -r gname gpath gsize gbasename; do
                if [ "$gpath" != "$largest_file" ]; then
                    echo -e "    ${RED}🗑️  Eliminando: $gbasename${NC}"
                    rm -f "$gpath"
                    cleaned_count=$((cleaned_count + 1))
                else
                    echo -e "    ${GREEN}✅ Manteniendo: $gbasename (más grande)${NC}"
                fi
            done
        fi
    done
    
    rm -f "$temp_groups" "$temp_analysis"
    
    echo ""
    echo -e "${GREEN}🎉 Limpieza completada!${NC}"
    echo -e "${BLUE}📊 Estadísticas:${NC}"
    echo "  - Archivos eliminados: $cleaned_count"
    echo "  - Backup guardado en: $backup_dir"
}

# Función para mostrar estadísticas
show_stats() {
    echo -e "${BLUE}📊 Estadísticas de la biblioteca:${NC}"
    total_files=$(find "$BIBLIOTECA_DIR" -name "*.pdf" | wc -l)
    total_size=$(find "$BIBLIOTECA_DIR" -name "*.pdf" -exec stat -f%z {} + 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
    large_files=$(find "$BIBLIOTECA_DIR" -name "*.pdf" -size +50M | wc -l)
    
    echo "  - Total de PDFs: $total_files"
    echo "  - Tamaño total: $(numfmt --to=iec $total_size)"
    echo "  - Archivos > 50MB: $large_files"
    echo ""
}

# Menú principal
echo -e "${YELLOW}¿Qué deseas hacer?${NC}"
echo "1. 📊 Mostrar estadísticas"
echo "2. 🔍 Detectar duplicados (solo mostrar)"
echo "3. 🧹 Limpiar duplicados automáticamente"
echo "4. 🚪 Salir"
echo ""
read -p "Selecciona una opción (1-4): " option

case $option in
    1)
        show_stats
        ;;
    2)
        show_stats
        find_duplicates_by_name
        ;;
    3)
        echo -e "${YELLOW}⚠️  Esta acción eliminará archivos duplicados permanentemente${NC}"
        echo -e "${YELLOW}⚠️  Se creará un backup automáticamente${NC}"
        echo ""
        read -p "¿Estás seguro? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            clean_duplicates
            show_stats
        else
            echo "Operación cancelada."
        fi
        ;;
    4)
        echo "¡Hasta luego!"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Opción inválida${NC}"
        exit 1
        ;;
esac