#!/usr/bin/env python3
"""
Script automático para limpiar archivos duplicados y vacíos
"""
import os
import shutil
from pathlib import Path
from collections import defaultdict
import hashlib

def clean_biblioteca_automatically(biblioteca_dir):
    """Limpiar automáticamente duplicados obvios y archivos vacíos"""
    
    print("🧹 Iniciando limpieza automática...")
    
    if not os.path.exists(biblioteca_dir):
        print(f"❌ Directorio no encontrado: {biblioteca_dir}")
        return
    
    # Contadores
    empty_files_removed = 0
    duplicates_removed = 0
    
    # 1. ELIMINAR ARCHIVOS VACÍOS (0 bytes)
    print("\n🗑️  Eliminando archivos vacíos (0 bytes)...")
    for root, dirs, files in os.walk(biblioteca_dir):
        for file in files:
            if file.lower().endswith('.pdf'):
                filepath = os.path.join(root, file)
                try:
                    size = os.path.getsize(filepath)
                    if size == 0:
                        os.remove(filepath)
                        print(f"  ❌ Eliminado (vacío): {file}")
                        empty_files_removed += 1
                except Exception as e:
                    print(f"  ⚠️  Error con {file}: {e}")
    
    # 2. ELIMINAR DUPLICADOS POR SUFIJO NUMÉRICO
    print("\n🔄 Eliminando duplicados con sufijos numéricos...")
    
    # Agrupar archivos por nombre base
    files_by_base = defaultdict(list)
    
    for root, dirs, files in os.walk(biblioteca_dir):
        for file in files:
            if file.lower().endswith('.pdf'):
                filepath = os.path.join(root, file)
                try:
                    size = os.path.getsize(filepath)
                    if size > 0:  # Solo archivos no vacíos
                        # Obtener nombre base sin sufijo numérico
                        name_no_ext = os.path.splitext(file)[0]
                        
                        # Detectar patrones de sufijos
                        base_name = name_no_ext
                        
                        # Patrón " 1", " 2", " (1)", " (2)", "_2", etc.
                        import re
                        base_name = re.sub(r' \d+$', '', base_name)  # " 1", " 2"
                        base_name = re.sub(r' \(\d+\)$', '', base_name)  # " (1)", " (2)"
                        base_name = re.sub(r'_\d+$', '', base_name)  # "_1", "_2"
                        base_name = re.sub(r'[Cc]onflicto.*$', '', base_name)  # "[Conflicto]"
                        
                        files_by_base[base_name].append({
                            'path': filepath,
                            'name': file,
                            'size': size,
                            'original_name': name_no_ext
                        })
                except Exception as e:
                    continue
    
    # Procesar grupos con múltiples archivos
    for base_name, file_group in files_by_base.items():
        if len(file_group) > 1:
            # Ordenar por tamaño (mantener el más grande)
            file_group.sort(key=lambda x: x['size'], reverse=True)
            
            print(f"\n📁 Grupo: {base_name}")
            
            # Mantener solo el más grande
            kept_file = file_group[0]
            print(f"  ✅ Manteniendo: {kept_file['name']} ({kept_file['size']} bytes)")
            
            # Eliminar los demás
            for file_info in file_group[1:]:
                try:
                    os.remove(file_info['path'])
                    print(f"  ❌ Eliminado: {file_info['name']} ({file_info['size']} bytes)")
                    duplicates_removed += 1
                except Exception as e:
                    print(f"  ⚠️  Error eliminando {file_info['name']}: {e}")
    
    # 3. CREAR BACKUP DE ARCHIVOS GRANDES PROBLEMÁTICOS
    print(f"\n💾 Revisando archivos grandes...")
    
    large_files = []
    for root, dirs, files in os.walk(biblioteca_dir):
        for file in files:
            if file.lower().endswith('.pdf'):
                filepath = os.path.join(root, file)
                try:
                    size = os.path.getsize(filepath)
                    if size > 90 * 1024 * 1024:  # > 90MB
                        large_files.append({
                            'path': filepath,
                            'name': file,
                            'size': size
                        })
                except Exception:
                    continue
    
    if large_files:
        print(f"  📋 Archivos muy grandes encontrados:")
        for file_info in large_files:
            size_mb = file_info['size'] / (1024 * 1024)
            print(f"    - {file_info['name']}: {size_mb:.1f}MB")
    
    # ESTADÍSTICAS FINALES
    print(f"\n🎉 Limpieza automática completada!")
    print(f"📊 Resumen:")
    print(f"  - Archivos vacíos eliminados: {empty_files_removed}")
    print(f"  - Duplicados eliminados: {duplicates_removed}")
    print(f"  - Archivos grandes detectados: {len(large_files)}")
    
    # Obtener nuevas estadísticas
    total_files = 0
    total_size = 0
    
    for root, dirs, files in os.walk(biblioteca_dir):
        for file in files:
            if file.lower().endswith('.pdf'):
                filepath = os.path.join(root, file)
                try:
                    size = os.path.getsize(filepath)
                    total_files += 1
                    total_size += size
                except Exception:
                    continue
    
    size_gb = total_size / (1024 * 1024 * 1024)
    print(f"\n📊 Estadísticas finales:")
    print(f"  - Total de PDFs: {total_files}")
    print(f"  - Tamaño total: {size_gb:.1f}GB")

if __name__ == "__main__":
    biblioteca_dir = os.path.expanduser("~/Documentos/Zotero Biblioteca")
    
    print("🧹 Limpiador Automático de Biblioteca Zotero")
    print("=" * 45)
    print(f"📁 Directorio: {biblioteca_dir}")
    
    print("\n⚠️  ADVERTENCIA: Este script eliminará archivos automáticamente")
    print("  - Archivos vacíos (0 bytes)")
    print("  - Duplicados con sufijos numéricos")
    print("  - Archivos con '[Conflicto]' en el nombre")
    
    respuesta = input("\n¿Continuar? (y/n): ").lower().strip()
    
    if respuesta == 'y':
        clean_biblioteca_automatically(biblioteca_dir)
    else:
        print("❌ Operación cancelada")