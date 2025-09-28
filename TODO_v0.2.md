# 📋 TODO List - Zotero Web Server v0.2

## 🚀 En desarrollo activo:

### **🎯 Sprint Actual: Dashboard y Estadísticas**

#### ✅ Completado:
- [x] Branch v0.2 creado
- [x] Plan de desarrollo documentado
- [x] Servidor base funcionando (100/5690 PDFs indexados)

#### 🔄 En progreso:
- [ ] **Dashboard principal con métricas**
  - [ ] Integrar Chart.js
  - [ ] Gráfico de progreso indexación
  - [ ] Estadísticas tiempo real
  - [ ] Indicadores de estado sistema

#### ⏳ Próximo:
- [ ] **Búsqueda avanzada**
  - [ ] Filtros múltiples
  - [ ] Autocompletado
  - [ ] Historial búsquedas

---

## 🔧 Issues identificados para resolver:

### **🐛 Bugs pendientes:**
1. [ ] **Indexación lenta**: 100/5690 PDFs (1.76% completado)
   - Investigar cuello de botella OCR
   - Optimizar paralelización
   - Mejorar algoritmo priorización

2. [ ] **Memory leaks potenciales**
   - Revisar garbage collection 
   - Optimizar Maps y cache
   - Monitoreo memoria continuo

3. [ ] **Error handling incompleto**
   - Manejo errores red
   - Retry automático requests
   - Feedback usuario errores

### **⚡ Performance mejoras:**
1. [ ] **Lazy loading carpetas**
   - Cargar solo carpetas visibles
   - Pagination inteligente
   - Virtual scrolling

2. [ ] **Cache inteligente**
   - Cache resultados búsqueda
   - Persistencia local storage
   - Invalidación automática

3. [ ] **Índice pre-construido**
   - Build inicial completo
   - Incremental updates
   - Búsqueda más rápida

### **🎨 UX/UI mejoras:**
1. [ ] **Mobile responsive**
   - Breakpoints optimizados
   - Touch gestures
   - Panel colapsible

2. [ ] **Dark mode**
   - Toggle light/dark
   - Persistir preferencia
   - Iconos adaptados

3. [ ] **Loading states**
   - Skeleton screens
   - Progress indicators
   - Smooth transitions

---

## 📅 Timeline Sprints:

### **Sprint 1 (Semana 1): Dashboard Core**
- **Lunes**: Setup Chart.js + métricas básicas
- **Martes**: Gráfico progreso indexación  
- **Miércoles**: Stats tiempo real con WebSocket
- **Jueves**: Indicadores estado sistema
- **Viernes**: Testing + refinamiento

### **Sprint 2 (Semana 2): Búsqueda Avanzada**
- **Lunes**: Filtros múltiples (fecha, tipo, tamaño)
- **Martes**: Integrar Fuse.js autocompletado
- **Miércoles**: Historial búsquedas persistente  
- **Jueves**: Búsqueda metadatos Zotero
- **Viernes**: Testing + optimización

### **Sprint 3 (Semana 3): Mobile & PWA**
- **Lunes**: Responsive breakpoints
- **Martes**: PWA manifest + service worker
- **Miércoles**: Offline capabilities básicas
- **Jueves**: Touch optimizations  
- **Viernes**: Testing + deployment

---

## 🎯 Definition of Done:

Para que una feature se considere **DONE**:

✅ **Funcionalidad:**
- [ ] Implementada según especificación
- [ ] Tested en Chrome, Firefox, Safari
- [ ] Mobile responsive (iPhone, Android)
- [ ] Performance < 2s load time

✅ **Código:**
- [ ] Code review completado
- [ ] Tests unitarios escritos
- [ ] Documentación actualizada
- [ ] Sin warnings ESLint

✅ **UX:**
- [ ] Loading states implementados
- [ ] Error handling completo
- [ ] Feedback usuario apropiado
- [ ] Accesible (básico)

---

## 🚀 Ideas para versiones futuras:

### **v0.3 (Future)**:
- Multi-tenancy / usuarios
- Integración directa API Zotero
- OCR con IA (GPT-4 Vision)
- Análisis semántico documentos

### **v0.4 (Future)**:
- Collaboration features
- Document annotations
- Advanced analytics
- Plugin system

---

*Actualizado: Septiembre 28, 2025*  
*Branch: v0.2*