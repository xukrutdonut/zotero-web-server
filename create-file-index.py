#!/usr/bin/env python3
"""
Script para optimizar el servidor para archivos grandes
"""
import json
import os
from pathlib import Path

def create_file_size_index(biblioteca_dir, output_file):
    """Crear índice de tamaños de archivos para optimización"""
    
    print("📊 Creando índice de tamaños de archivos...")
    
    file_sizes = {}
    large_files = {}
    total_files = 0
    
    for root, dirs, files in os.walk(biblioteca_dir):
        for file in files:
            if file.lower().endswith('.pdf'):
                filepath = os.path.join(root, file)
                try:
                    size = os.path.getsize(filepath)
                    relative_path = os.path.relpath(filepath, biblioteca_dir)
                    
                    file_sizes[relative_path] = {
                        'size': size,
                        'size_mb': round(size / (1024 * 1024), 2)
                    }
                    
                    # Marcar archivos grandes
                    if size > 50 * 1024 * 1024:  # > 50MB
                        large_files[relative_path] = {
                            'size': size,
                            'size_mb': round(size / (1024 * 1024), 2),
                            'category': 'very_large' if size > 100 * 1024 * 1024 else 'large'
                        }
                    
                    total_files += 1
                    
                    if total_files % 1000 == 0:
                        print(f"  Procesados: {total_files} archivos")
                        
                except Exception as e:
                    print(f"  ⚠️  Error con {file}: {e}")
    
    # Crear índice completo
    index_data = {
        'generated': str(Path().resolve()),
        'total_files': total_files,
        'large_files_count': len(large_files),
        'files': file_sizes,
        'large_files': large_files
    }
    
    # Guardar índice
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Índice creado: {output_file}")
    print(f"📊 Estadísticas:")
    print(f"  - Total de archivos: {total_files}")
    print(f"  - Archivos grandes (>50MB): {len(large_files)}")
    
    return index_data

def main():
    biblioteca_dir = os.path.expanduser("~/Documentos/Zotero Biblioteca")
    output_file = "file-size-index.json"
    
    print("📊 Optimizador de Archivos Grandes - Zotero Web Server")
    print("=" * 55)
    
    if not os.path.exists(biblioteca_dir):
        print(f"❌ Directorio no encontrado: {biblioteca_dir}")
        return
    
    # Crear índice
    index_data = create_file_size_index(biblioteca_dir, output_file)
    
    # Mostrar archivos más grandes
    large_files_sorted = sorted(
        index_data['large_files'].items(),
        key=lambda x: x[1]['size'],
        reverse=True
    )
    
    print(f"\n🔍 Top 10 archivos más grandes:")
    for i, (filepath, info) in enumerate(large_files_sorted[:10], 1):
        filename = os.path.basename(filepath)
        print(f"  {i}. {filename} ({info['size_mb']}MB)")

if __name__ == "__main__":
    main()