#!/bin/bash

echo "🔍 Generando índice de PDFs directos..."

# Crear archivo de índice de PDFs
INDEX_FILE="~/zotero-web-server/web/pdf-index.json"

echo "Escaneando ~/Zotero/storage/ para PDFs..."

# Generar JSON con lista de PDFs
cat > ~/zotero-web-server/web/pdf-index.json << 'EOF'
{
  "pdfs": [],
  "generated": "2025-09-25T22:00:00.000Z",
  "total": 0
}
EOF

# Crear script temporal para generar el índice
cat > /tmp/generate_pdf_index.py << 'EOF'
import os
import json
import urllib.parse
from datetime import datetime

def scan_storage():
    storage_path = "/home/arkantu/Zotero/storage"
    pdfs = []
    
    if not os.path.exists(storage_path):
        return pdfs
    
    for folder in os.listdir(storage_path):
        folder_path = os.path.join(storage_path, folder)
        if os.path.isdir(folder_path):
            try:
                for file in os.listdir(folder_path):
                    if file.lower().endswith('.pdf'):
                        # Crear URL directa
                        encoded_file = urllib.parse.quote(file)
                        pdf_url = f"/storage/{folder}/{encoded_file}"
                        
                        pdfs.append({
                            "folder": folder,
                            "filename": file,
                            "url": pdf_url,
                            "title": file.replace('.pdf', '').replace('_', ' ')
                        })
            except:
                continue
    
    return pdfs

# Generar índice
pdfs = scan_storage()
index_data = {
    "pdfs": pdfs[:500],  # Limitar a 500 para rendimiento
    "generated": datetime.now().isoformat(),
    "total": len(pdfs)
}

# Escribir JSON
with open('/home/arkantu/zotero-web-server/web/pdf-index.json', 'w', encoding='utf-8') as f:
    json.dump(index_data, f, indent=2, ensure_ascii=False)

print(f"✅ Generado índice con {len(pdfs)} PDFs")
print(f"📄 Primeros 5 PDFs:")
for pdf in pdfs[:5]:
    print(f"   - {pdf['title'][:50]}...")
    print(f"     URL: {pdf['url']}")
EOF

# Ejecutar script
python3 /tmp/generate_pdf_index.py

# Limpiar script temporal
rm /tmp/generate_pdf_index.py

echo "✅ Índice de PDFs generado en web/pdf-index.json"
echo "📊 Para usar en frontend: fetch('/pdf-index.json')"