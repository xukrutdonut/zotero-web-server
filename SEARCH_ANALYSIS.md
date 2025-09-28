# 🔍 Análisis búsqueda "desk reference" - v0.2

## 🎯 Estado actual:

### ✅ **Lo que funciona:**
- API de búsqueda responde correctamente
- Encuentra 5 resultados por contenido indexado
- Archivo existe: `American Psychiatric Association - 2013 - Desk reference to the diagnostic criteria from DSM-5.pdf` (1.8MB)

### ❌ **Problema identificado:**
- **Solo 100/5701 archivos indexados** (1.75%)  
- El archivo "Desk reference" **no está indexado aún**
- Búsqueda solo busca en contenido, no en nombres de archivo

## 🚀 **Soluciones implementadas:**

### **Opción A: Mejora rápida (5 min)**
```javascript
// Agregar búsqueda por nombre archivo al endpoint actual
// Modificar función searchInPDFs para incluir nombres
```

### **Opción B: Forzar indexación archivo específico (2 min)**  
```bash
# Mover archivo DSM-5 al inicio de cola de indexación
# Indexar manualmente archivos importantes primero
```

### **Opción C: Búsqueda híbrida completa (15 min)**
```javascript
// Sistema dual: contenido indexado + nombres archivo
// UI mejorada con indicadores de estado
```

## 📊 **Recomendación inmediata:**

**Vamos con Opción A + B combinadas:**

1. ✅ Modificar búsqueda para incluir nombres archivo  
2. ✅ Priorizar indexación archivos importantes
3. ✅ Usuario puede encontrar "desk reference" inmediatamente

**¿Proceder con implementación rápida?**