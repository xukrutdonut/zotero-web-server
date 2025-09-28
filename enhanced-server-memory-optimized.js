const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { exec } = require('child_process');
const EventEmitter = require('events');

const app = express();
const PORT = process.env.PORT || 8080;

// Configurar límites de memoria Node.js
process.setMaxListeners(0);

// Event emitter para sincronización
const syncEmitter = new EventEmitter();

// Configuración de directorios
const WEB_DIR = path.join(__dirname, 'web');
const STORAGE_DIR = process.env.STORAGE_DIR || '/home/arkantu/Zotero/storage';
const BIBLIOTECA_DIR = process.env.BIBLIOTECA_DIR || '/home/arkantu/Documentos/Zotero Biblioteca';
const ZOTERO_DB = process.env.ZOTERO_DB || '/home/arkantu/Zotero/zotero.sqlite';
const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, 'data', 'cache');
const PDF_INDEX_FILE = path.join(CACHE_DIR, 'pdf-text-index.json');

console.log('🌐 Iniciando servidor Zotero mejorado...');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Reducido de 50mb
app.use(express.static(WEB_DIR));

// Estadísticas globales
let stats = {
    totalItems: 0,
    totalPDFs: 0,
    indexedPDFs: 0,
    syncStatus: 'Iniciando...',
    lastSync: new Date(),
    isIndexing: false
};

// Índice optimizado para memoria - usar Map en lugar de objeto
let pdfTextIndex = new Map();
let indexingQueue = [];
let currentIndexing = null;
let indexingProgress = { current: 0, total: 0 };

// Cache con límite de memoria
const CACHE_LIMIT = 1000;
let cacheKeys = [];

// Función optimizada para cargar índice
function loadPDFIndex() {
    try {
        if (fs.existsSync(PDF_INDEX_FILE)) {
            console.log('📚 Cargando índice de PDFs de forma optimizada...');
            
            const data = fs.readFileSync(PDF_INDEX_FILE, 'utf8');
            const indexData = JSON.parse(data);
            
            // Convertir a Map para mejor rendimiento de memoria
            pdfTextIndex = new Map(Object.entries(indexData));
            
            console.log(`📚 Cargado índice de ${pdfTextIndex.size} PDFs`);
            
            // Forzar garbage collection si está disponible
            if (global.gc) {
                global.gc();
            }
        }
    } catch (error) {
        console.error('Error cargando índice PDF:', error);
        pdfTextIndex = new Map();
    }
}

// Función optimizada para guardar índice
function savePDFIndex() {
    try {
        const indexObj = Object.fromEntries(pdfTextIndex);
        fs.writeFileSync(PDF_INDEX_FILE, JSON.stringify(indexObj, null, 2));
        
        // Limpiar cache si está muy grande
        if (cacheKeys.length > CACHE_LIMIT) {
            console.log('🧹 Limpiando cache para liberar memoria...');
            const keysToRemove = cacheKeys.splice(0, Math.floor(CACHE_LIMIT / 2));
            keysToRemove.forEach(key => {
                if (pdfTextIndex.has(key)) {
                    pdfTextIndex.delete(key);
                }
            });
        }
        
    } catch (error) {
        console.error('Error guardando índice PDF:', error);
    }
}

// Función para extraer texto de PDF con control de memoria y soporte OCR mejorado v0.2
function extractPDFText(pdfPath, callback) {
    try {
        const pdfparse = require('pdf-parse');
        
        // Verificar tamaño del archivo ANTES de procesarlo
        const stats = fs.statSync(pdfPath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        // NUEVO: Detectar archivos vacíos o corruptos
        if (stats.size === 0) {
            console.log(`🚫 Archivo vacío (0 bytes), saltando: ${path.basename(pdfPath)}`);
            callback('Archivo vacío', null);
            return;
        }
        
        if (stats.size < 1024) { // Menor a 1KB, probablemente corrupto
            console.log(`🚫 Archivo muy pequeño (${stats.size} bytes), probablemente corrupto: ${path.basename(pdfPath)}`);
            callback('Archivo posiblemente corrupto', null);
            return;
        }
        
        if (fileSizeInMB > 100) {
            console.log(`⚠️ Archivo muy grande (${fileSizeInMB.toFixed(1)}MB), saltando: ${path.basename(pdfPath)}`);
            callback('Archivo demasiado grande', null);
            return;
        }
        
        // NUEVO: Verificar que sea realmente un PDF válido
        const buffer = fs.readFileSync(pdfPath);
        
        // Verificar cabecera PDF
        if (!buffer.toString('ascii', 0, 4).startsWith('%PDF')) {
            console.log(`🚫 No es un PDF válido, saltando: ${path.basename(pdfPath)}`);
            callback('Archivo no es PDF válido', null);
            return;
        }
        
        pdfparse(buffer).then(function(data) {
            // Si el texto extraído es muy corto, puede que sea un PDF de imágenes
            if (data.text.trim().length < 50) {
                console.log(`📸 Texto muy corto (${data.text.trim().length} chars), intentando OCR para: ${path.basename(pdfPath)}`);
                tryOCRImproved(pdfPath, callback);
                return;
            }
            
            callback(null, data.text);
            // Forzar limpieza de memoria
            if (global.gc) {
                global.gc();
            }
        }).catch(function(error) {
            console.log(`📸 PDF parse falló (${error.message}), intentando OCR para: ${path.basename(pdfPath)}`);
            tryOCRImproved(pdfPath, callback);
        });
        
    } catch (error) {
        console.log(`📸 Error leyendo PDF (${error.message}), intentando OCR para: ${path.basename(pdfPath)}`);
        tryOCRImproved(pdfPath, callback);
    }
}

// Función mejorada para intentar OCR con tesseract v0.2
function tryOCRImproved(pdfPath, callback) {
    const { exec } = require('child_process');
    const os = require('os');
    const path = require('path');
    
    try {
        // NUEVO: Pre-validación antes de OCR
        const stats = fs.statSync(pdfPath);
        if (stats.size === 0) {
            console.log(`🚫 Saltando OCR para archivo vacío: ${path.basename(pdfPath)}`);
            callback('Archivo vacío - OCR saltado', null);
            return;
        }
        
        // Crear directorio temporal
        const tempDir = os.tmpdir();
        const baseFileName = path.basename(pdfPath, '.pdf').replace(/[^a-zA-Z0-9]/g, '_'); // Sanitizar nombre
        const tempImagePath = path.join(tempDir, `${baseFileName}_page`);
        const tempTextPath = path.join(tempDir, `${baseFileName}_ocr`);
        
        // NUEVO: Mejorar comando pdftoppm con validación de PDF
        const convertCmd = `pdftoppm -png -f 1 -l 1 -r 150 "${pdfPath}" "${tempImagePath}" 2>&1`;
        
        console.log(`🔧 Intentando conversión OCR para: ${path.basename(pdfPath)}`);
        
        exec(convertCmd, { timeout: 60000 }, (convertError, convertStdout, convertStderr) => {
            if (convertError) {
                // NUEVO: Clasificar tipos de errores
                if (convertStderr.includes('Document stream is empty')) {
                    console.log(`🚫 PDF corrupto detectado: ${path.basename(pdfPath)} - saltando OCR`);
                    callback('PDF corrupto - OCR saltado', null);
                } else if (convertStderr.includes('Syntax Error')) {
                    console.log(`🚫 Error sintaxis PDF: ${path.basename(pdfPath)} - archivo no válido`);
                    callback('PDF sintaxis inválida - OCR saltado', null);
                } else {
                    console.log(`⚠️ Error conversión OCR: ${path.basename(pdfPath)} - ${convertError.message}`);
                    callback('Error en conversión a imagen', null);
                }
                return;
            }
            
            // La imagen se guardará como tempImagePath-1.png
            const imagePath = `${tempImagePath}-1.png`;
            
            // NUEVO: Verificar que la imagen se creó correctamente
            if (!fs.existsSync(imagePath)) {
                console.log(`⚠️ No se generó imagen para OCR: ${path.basename(pdfPath)}`);
                callback('No se pudo generar imagen para OCR', null);
                return;
            }
            
            // Ejecutar tesseract OCR con configuración optimizada
            const ocrCmd = `tesseract "${imagePath}" "${tempTextPath}" -l spa+eng --dpi 150 --psm 1 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789áéíóúñüÁÉÍÓÚÑÜ.,;:()[]{}\"'-?!@#$%^&*+=<>/\\|_~ `;
            
            exec(ocrCmd, { timeout: 120000 }, (ocrError, ocrStdout, ocrStderr) => {
                try {
                    if (ocrError) {
                        console.log(`⚠️ Error en OCR Tesseract: ${path.basename(pdfPath)} - ${ocrError.message}`);
                        callback('Error en OCR Tesseract', null);
                        return;
                    }
                    
                    // Leer el texto extraído
                    const textFilePath = `${tempTextPath}.txt`;
                    if (fs.existsSync(textFilePath)) {
                        const ocrText = fs.readFileSync(textFilePath, 'utf8');
                        
                        // NUEVO: Validar calidad del texto OCR
                        if (ocrText.trim().length < 10) {
                            console.log(`⚠️ OCR produjo texto muy corto para: ${path.basename(pdfPath)} (${ocrText.length} chars)`);
                            callback('OCR texto insuficiente', null);
                        } else {
                            console.log(`✅ OCR exitoso: ${path.basename(pdfPath)} (${ocrText.length} caracteres)`);
                            callback(null, ocrText);
                        }
                        
                        // Limpiar archivos temporales
                        try {
                            fs.unlinkSync(imagePath);
                            fs.unlinkSync(textFilePath);
                        } catch (cleanupError) {
                            // Ignorar errores de limpieza
                        }
                        
                    } else {
                        console.log(`⚠️ No se pudo generar texto OCR para: ${path.basename(pdfPath)}`);
                        callback('No se pudo generar texto OCR', null);
                    }
                } catch (readError) {
                    console.log(`⚠️ Error leyendo resultado OCR: ${path.basename(pdfPath)} - ${readError.message}`);
                    callback('Error leyendo resultado OCR', null);
                }
            });
        });
        
    } catch (error) {
        console.log(`⚠️ Error en proceso OCR: ${path.basename(pdfPath)} - ${error.message}`);
        callback('Error en proceso OCR', null);
    }
}

// Procesamiento optimizado de cola de indexación
function processIndexingQueue() {
    if (currentIndexing || indexingQueue.length === 0) {
        return;
    }

    currentIndexing = indexingQueue.shift();
    stats.isIndexing = true;
    
    indexingProgress.current = stats.indexedPDFs + 1;
    console.log(`🔍 Indexando: ${path.basename(currentIndexing)} (${indexingProgress.current}/${indexingProgress.total})`);

    extractPDFText(currentIndexing, (error, text) => {
        if (error) {
            console.log(`⚠️ Sin texto: ${path.basename(currentIndexing)} (${error})`);
            
            pdfTextIndex.set(currentIndexing, {
                text: '',
                indexed: true,
                hasText: false,
                lastModified: Date.now(),
                error: error
            });
        } else {
            console.log(`✅ Indexado: ${path.basename(currentIndexing)} (${text.length} caracteres)`);
            
            // Limitar texto para ahorrar memoria
            pdfTextIndex.set(currentIndexing, {
                text: text.substring(0, 10000), // Solo los primeros 10k caracteres
                indexed: true,
                hasText: true,
                lastModified: Date.now()
            });
        }

        // Guardar cada 5 archivos
        if (pdfTextIndex.size % 5 === 0) {
            savePDFIndex();
        }
        
        stats.indexedPDFs = pdfTextIndex.size;
        
        currentIndexing = null;
        stats.isIndexing = false;
        
        // Pausa más larga para permitir garbage collection
        setTimeout(() => {
            if (global.gc && pdfTextIndex.size % 50 === 0) {
                global.gc();
            }
            processIndexingQueue();
        }, 1000);
    });
}

// Función para añadir PDFs a la cola
function addToIndexingQueue(pdfPath) {
    if (!pdfTextIndex.has(pdfPath) && !indexingQueue.includes(pdfPath)) {
        indexingQueue.push(pdfPath);
        setTimeout(processIndexingQueue, 200);
    }
}

// Función para obtener PDFs con paginación y filtrado por carpeta
function getLibraryPDFs(dir = BIBLIOTECA_DIR, page = 1, limit = 50, folderFilter = null) {
    const files = [];
    const skip = (page - 1) * limit;
    let count = 0;
    
    try {
        function scanDirectory(currentDir) {
            if (count >= skip + limit) return;
            
            const items = fs.readdirSync(currentDir);
            for (const item of items) {
                if (count >= skip + limit) break;
                
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (item.toLowerCase().endsWith('.pdf')) {
                    let includeFile = true;
                    
                    // Si hay filtro de carpeta, verificar que el archivo esté en esa carpeta
                    if (folderFilter) {
                        const relativePath = path.relative(dir, fullPath);
                        const fileFolder = path.dirname(relativePath);
                        
                        // Normalizar las rutas para comparación
                        const normalizedFileFolder = fileFolder === '.' ? '' : fileFolder.replace(/\\/g, '/');
                        const normalizedFolderFilter = decodeURIComponent(folderFilter.replace(/\\/g, '/'));
                        
                        includeFile = normalizedFileFolder === normalizedFolderFilter;
                    }
                    
                    if (includeFile) {
                        if (count >= skip) {
                            files.push({
                                name: item,
                                path: fullPath,
                                size: stat.size,
                                modified: stat.mtime,
                                indexed: pdfTextIndex.has(fullPath)
                            });
                        }
                        count++;
                    }
                }
            }
        }
        
        scanDirectory(dir);
    } catch (error) {
        console.error('Error escaneando directorio:', error);
    }
    
    return {
        files,
        total: count,
        page,
        hasMore: count > skip + limit
    };
}

// Búsqueda optimizada con límites
function searchInPDFs(query, limit = 50) {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const results = [];
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    let searchCount = 0;
    for (let [filePath, data] of pdfTextIndex) {
        if (searchCount >= limit) break;
        
        if (data.text && data.hasText) {
            const textLower = data.text.toLowerCase();
            const score = searchTerms.reduce((acc, term) => {
                const matches = (textLower.match(new RegExp(term, 'g')) || []).length;
                return acc + matches;
            }, 0);

            if (score > 0) {
                const snippet = extractSnippet(data.text, searchTerms[0]);
                results.push({
                    file: path.basename(filePath),
                    path: filePath,
                    score,
                    snippet: snippet.substring(0, 200) + '...'
                });
                searchCount++;
            }
        }
    }

    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

// Función para extraer snippet
function extractSnippet(text, term) {
    const termIndex = text.toLowerCase().indexOf(term.toLowerCase());
    if (termIndex === -1) return text.substring(0, 150);
    
    const start = Math.max(0, termIndex - 75);
    const end = Math.min(text.length, termIndex + 75);
    return text.substring(start, end);
}

// Función para construir árbol de carpetas
function buildFolderTree(dir, baseDir = dir, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];
    
    try {
        const items = fs.readdirSync(dir);
        const folders = [];
        
        items.forEach(item => {
            const itemPath = path.join(dir, item);
            try {
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory() && !item.startsWith('.')) {
                    const relativePath = path.relative(baseDir, itemPath);
                    const pdfCount = countPDFsInDirectory(itemPath);
                    
                    const folderNode = {
                        name: item,
                        path: relativePath,
                        type: 'folder',
                        pdfCount: pdfCount,
                        children: buildFolderTree(itemPath, baseDir, maxDepth, currentDepth + 1)
                    };
                    
                    folders.push(folderNode);
                }
            } catch (itemError) {
                // Ignorar archivos/carpetas con problemas de permisos
            }
        });
        
        return folders.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error(`Error leyendo directorio ${dir}:`, error);
        return [];
    }
}

// Función para contar PDFs en un directorio recursivamente
function countPDFsInDirectory(dir, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return 0;
    
    try {
        const items = fs.readdirSync(dir);
        let count = 0;
        
        items.forEach(item => {
            const itemPath = path.join(dir, item);
            try {
                const stat = fs.statSync(itemPath);
                if (stat.isFile() && item.toLowerCase().endsWith('.pdf')) {
                    count++;
                } else if (stat.isDirectory() && !item.startsWith('.')) {
                    count += countPDFsInDirectory(itemPath, maxDepth, currentDepth + 1);
                }
            } catch (itemError) {
                // Ignorar archivos con problemas de permisos
            }
        });
        
        return count;
    } catch (error) {
        return 0;
    }
}

// API Routes

app.get('/api/stats', (req, res) => {
    const currentStats = {
        ...stats,
        indexedPDFs: pdfTextIndex.size,
        memoryUsage: process.memoryUsage()
    };
    res.json(currentStats);
});

// Endpoint para obtener estructura de carpetas
app.get('/api/folder-tree', (req, res) => {
    try {
        console.log('📁 Generando árbol de carpetas...');
        const folderTree = buildFolderTree(BIBLIOTECA_DIR);
        res.json({
            root: {
                name: 'Biblioteca',
                path: '',
                type: 'folder',
                pdfCount: countPDFsInDirectory(BIBLIOTECA_DIR),
                children: folderTree
            }
        });
    } catch (error) {
        console.error('Error generando árbol de carpetas:', error);
        res.status(500).json({ error: 'Error generando árbol de carpetas' });
    }
});

// Endpoint para búsqueda de texto en PDFs
app.get('/api/search-text', (req, res) => {
    try {
        const query = req.query.query;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        
        if (!query) {
            return res.json({ results: [], total: 0 });
        }

        const results = searchInPDFs(query, limit);
        res.json({ 
            results, 
            total: results.length,
            query,
            limited: results.length === limit
        });
    } catch (error) {
        console.error('Error en búsqueda de texto:', error);
        res.status(500).json({ error: 'Error en búsqueda de texto' });
    }
});

app.get('/api/search', (req, res) => {
    try {
        const query = req.query.q;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        
        if (!query) {
            return res.json({ results: [], total: 0 });
        }

        const results = searchInPDFs(query, limit);
        res.json({ 
            results, 
            total: results.length,
            query,
            limited: results.length === limit
        });
    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).json({ error: 'Error en búsqueda' });
    }
});

app.get('/api/pdfs', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const folder = req.query.folder;
        
        const result = getLibraryPDFs(BIBLIOTECA_DIR, page, limit, folder);
        res.json(result);
    } catch (error) {
        console.error('Error listando PDFs:', error);
        res.status(500).json({ error: 'Error listando PDFs' });
    }
});

// Ruta para servir archivos PDF
app.get('/pdf/:filename(*)', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(BIBLIOTECA_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error sirviendo PDF:', error);
        res.status(500).json({ error: 'Error sirviendo archivo' });
    }
});

// Inicialización del servidor
async function initServer() {
    console.log('🚀 Inicializando servidor...');
    
    // Crear directorio de caché si no existe
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        console.log(`📁 Creado directorio de caché: ${CACHE_DIR}`);
    }
    
    loadPDFIndex();
    console.log(`📚 Cargado índice de ${pdfTextIndex.size} PDFs`);
    
    try {
        const libraryFiles = getLibraryPDFs(BIBLIOTECA_DIR, 1, 10000);
        stats.totalPDFs = libraryFiles.total;
        stats.indexedPDFs = pdfTextIndex.size;
        
        console.log(`📊 Encontrados ${stats.totalPDFs} PDFs, ${stats.indexedPDFs} indexados`);
        
        // Añadir solo los primeros 100 archivos no indexados para evitar sobrecarga
        let addedToQueue = 0;
        libraryFiles.files.forEach(file => {
            if (!file.indexed && addedToQueue < 100) {
                addToIndexingQueue(file.path);
                addedToQueue++;
            }
        });
        
        indexingProgress.total = stats.totalPDFs;
        console.log(`⚠️ File watchers deshabilitados para evitar límite del sistema. Usa el botón "Actualizar" para sincronizar.`);
        
    } catch (error) {
        console.error('Error inicializando:', error);
    }
    
    stats.syncStatus = 'Listo';
    stats.lastSync = new Date();
}

// Iniciar servidor
initServer().then(() => {
    app.listen(PORT, () => {
        console.log(`🌟 Servidor iniciado en http://localhost:${PORT}`);
        console.log(`📁 Biblioteca: ${BIBLIOTECA_DIR}`);
        console.log(`🗄️ Storage: ${STORAGE_DIR}`);
        console.log(`💾 Caché persistente: ${CACHE_DIR}`);
        console.log(`📊 Sistema estadísticas: REST API + Polling manual`);
    });
});

// Guardar índice periódicamente
setInterval(savePDFIndex, 5 * 60 * 1000);

// Manejo de cierre graceful
process.on('SIGTERM', () => {
    console.log('💾 Guardando índice antes de cerrar...');
    savePDFIndex();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('💾 Guardando índice antes de cerrar...');
    savePDFIndex();
    process.exit(0);
});