#!/usr/bin/env python3
"""
Script para detectar y limpiar archivos duplicados en la biblioteca Zotero
"""
import os
import hashlib
import sys
import re
from collections import defaultdict
from pathlib import Path

# Colores ANSI
class Colors:
    GREEN = '\033[92m'
    BLUE = '\033[94m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def format_size(size_bytes):
    """Convertir bytes a formato legible"""
    if size_bytes == 0:
        return "0B"
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.1f}{size_names[i]}"

def clean_filename(filename):
    """Limpiar nombre de archivo removiendo sufijos numéricos"""
    # Remover extensión
    name_no_ext = os.path.splitext(filename)[0]
    # Remover sufijos como " 1", " 2", " 3", etc.
    clean_name = re.sub(r' \d+$', '', name_no_ext)
    return clean_name

def get_file_hash(filepath):
    """Obtener hash MD5 del archivo (solo primeros 8KB para eficiencia)"""
    try:
        hash_md5 = hashlib.md5()
        with open(filepath, "rb") as f:
            # Solo leer primeros 8KB para rapidez
            chunk = f.read(8192)
            hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        print(f"{Colors.RED}Error leyendo {filepath}: {e}{Colors.ENDC}")
        return None

def analyze_library(biblioteca_dir):
    """Analizar biblioteca y detectar duplicados"""
    print(f"{Colors.BLUE}📊 Analizando biblioteca: {biblioteca_dir}{Colors.ENDC}")
    
    if not os.path.exists(biblioteca_dir):
        print(f"{Colors.RED}❌ Error: Directorio no encontrado{Colors.ENDC}")
        return
    
    # Dictionaries para análisis
    files_by_name = defaultdict(list)
    files_by_hash = defaultdict(list)
    total_files = 0
    total_size = 0
    large_files = 0
    
    print(f"{Colors.YELLOW}🔍 Escaneando archivos PDF...{Colors.ENDC}")
    
    # Buscar todos los PDFs
    for root, dirs, files in os.walk(biblioteca_dir):
        for file in files:
            if file.lower().endswith('.pdf'):
                filepath = os.path.join(root, file)
                try:
                    size = os.path.getsize(filepath)
                    total_files += 1
                    total_size += size
                    
                    if size > 50 * 1024 * 1024:  # > 50MB
                        large_files += 1
                    
                    # Agrupar por nombre limpio
                    clean_name = clean_filename(file)
                    files_by_name[clean_name].append({
                        'path': filepath,
                        'name': file,
                        'size': size
                    })
                    
                    # Calcular hash para archivos sospechosos de ser duplicados
                    if len(files_by_name[clean_name]) > 1 or any(f['size'] == size for f in files_by_name[clean_name]):
                        file_hash = get_file_hash(filepath)
                        if file_hash:
                            files_by_hash[file_hash].append({
                                'path': filepath,
                                'name': file,
                                'size': size
                            })
                    
                except OSError as e:
                    print(f"{Colors.RED}Error accediendo {filepath}: {e}{Colors.ENDC}")
    
    # Mostrar estadísticas
    print(f"\n{Colors.BLUE}📊 Estadísticas de la biblioteca:{Colors.ENDC}")
    print(f"  - Total de PDFs: {Colors.BOLD}{total_files}{Colors.ENDC}")
    print(f"  - Tamaño total: {Colors.BOLD}{format_size(total_size)}{Colors.ENDC}")
    print(f"  - Archivos > 50MB: {Colors.BOLD}{large_files}{Colors.ENDC}")
    
    # Detectar duplicados por nombre
    name_duplicates = {name: files for name, files in files_by_name.items() if len(files) > 1}
    
    # Detectar duplicados exactos por hash
    hash_duplicates = {hash_val: files for hash_val, files in files_by_hash.items() if len(files) > 1}
    
    print(f"\n{Colors.YELLOW}🔍 Duplicados detectados:{Colors.ENDC}")
    print(f"  - Grupos por nombre similar: {Colors.BOLD}{len(name_duplicates)}{Colors.ENDC}")
    print(f"  - Grupos de archivos idénticos: {Colors.BOLD}{len(hash_duplicates)}{Colors.ENDC}")
    
    # Mostrar duplicados por nombre
    if name_duplicates:
        print(f"\n{Colors.YELLOW}📋 Duplicados por nombre:{Colors.ENDC}")
        for name, files in sorted(name_duplicates.items())[:10]:  # Solo mostrar primeros 10
            print(f"\n{Colors.RED}🔴 Grupo: {name}{Colors.ENDC}")
            for file_info in sorted(files, key=lambda x: x['size'], reverse=True):
                size_str = format_size(file_info['size'])
                print(f"  - {file_info['name']} ({size_str})")
        
        if len(name_duplicates) > 10:
            print(f"  ... y {len(name_duplicates) - 10} grupos más")
    
    # Mostrar duplicados exactos
    if hash_duplicates:
        print(f"\n{Colors.RED}⚠️  Archivos completamente idénticos:{Colors.ENDC}")
        for hash_val, files in hash_duplicates.items():
            if len(files) > 1:
                print(f"\n{Colors.RED}🔴 Archivos idénticos ({format_size(files[0]['size'])}):{Colors.ENDC}")
                for file_info in files:
                    print(f"  - {file_info['name']}")
    
    return name_duplicates, hash_duplicates

def clean_duplicates_interactive(name_duplicates):
    """Limpiar duplicados de forma interactiva"""
    if not name_duplicates:
        print(f"{Colors.GREEN}✅ No se encontraron duplicados para limpiar{Colors.ENDC}")
        return
    
    print(f"\n{Colors.YELLOW}🧹 Limpieza interactiva de duplicados{Colors.ENDC}")
    print(f"Se mantendrá el archivo más grande de cada grupo")
    
    cleaned_count = 0
    
    for name, files in name_duplicates.items():
        if len(files) <= 1:
            continue
            
        print(f"\n{Colors.BLUE}📁 Grupo: {name}{Colors.ENDC}")
        
        # Ordenar por tamaño (más grande primero)
        files_sorted = sorted(files, key=lambda x: x['size'], reverse=True)
        
        # Mostrar archivos
        for i, file_info in enumerate(files_sorted):
            size_str = format_size(file_info['size'])
            mark = f"{Colors.GREEN}✅ MANTENER{Colors.ENDC}" if i == 0 else f"{Colors.RED}🗑️  ELIMINAR{Colors.ENDC}"
            print(f"  {i+1}. {file_info['name']} ({size_str}) {mark}")
        
        # Confirmar limpieza
        response = input(f"\n¿Limpiar este grupo? (y/n/s=saltar): ").lower().strip()
        
        if response == 'y':
            # Eliminar todos excepto el más grande
            for file_info in files_sorted[1:]:
                try:
                    os.remove(file_info['path'])
                    print(f"  {Colors.RED}🗑️  Eliminado: {file_info['name']}{Colors.ENDC}")
                    cleaned_count += 1
                except Exception as e:
                    print(f"  {Colors.RED}❌ Error eliminando {file_info['name']}: {e}{Colors.ENDC}")
            
            print(f"  {Colors.GREEN}✅ Mantenido: {files_sorted[0]['name']}{Colors.ENDC}")
        elif response == 's':
            print(f"  ⏭️  Saltado")
            continue
        else:
            print(f"  ❌ Cancelado")
            break
    
    print(f"\n{Colors.GREEN}🎉 Limpieza completada!{Colors.ENDC}")
    print(f"📊 Archivos eliminados: {cleaned_count}")

def main():
    biblioteca_dir = os.path.expanduser("~/Documentos/Zotero Biblioteca")
    
    print(f"{Colors.BOLD}🧹 Detector de Duplicados - Zotero Web Server{Colors.ENDC}")
    print("=" * 50)
    
    if len(sys.argv) > 1:
        biblioteca_dir = sys.argv[1]
    
    # Analizar biblioteca
    name_duplicates, hash_duplicates = analyze_library(biblioteca_dir)
    
    # Menú de opciones
    print(f"\n{Colors.YELLOW}¿Qué deseas hacer?{Colors.ENDC}")
    print("1. 🏁 Terminar (solo mostrar estadísticas)")
    print("2. 🧹 Limpiar duplicados interactivamente")
    print("3. 📋 Ver lista completa de duplicados")
    
    choice = input("\nSelecciona una opción (1-3): ").strip()
    
    if choice == '2':
        print(f"\n{Colors.RED}⚠️  ADVERTENCIA: Esta acción eliminará archivos permanentemente{Colors.ENDC}")
        confirm = input("¿Estás seguro? (y/n): ").lower().strip()
        if confirm == 'y':
            clean_duplicates_interactive(name_duplicates)
        else:
            print("Operación cancelada")
    elif choice == '3':
        print(f"\n{Colors.BLUE}📋 Lista completa de duplicados:{Colors.ENDC}")
        for name, files in name_duplicates.items():
            print(f"\n{Colors.YELLOW}{name}:{Colors.ENDC}")
            for file_info in files:
                print(f"  - {file_info['name']} ({format_size(file_info['size'])})")
    else:
        print(f"{Colors.GREEN}✅ Análisis completado{Colors.ENDC}")

if __name__ == "__main__":
    main()