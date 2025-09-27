const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const WebSocket = require('ws');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn, exec } = require('child_process');

const app = express();
const PORT = 8080;

// Configuración de directorios
const ZOTERO_DIR = '/home/arkantu/Zotero';
const BIBLIOTECA_DIR = '/home/arkantu/Documentos/Zotero Biblioteca';
const WEB_DIR = path.join(__dirname, 'web');
const PDF_INDEX_FILE = path.join(__dirname, 'pdf-text-index.json');

console.log('🌐 Iniciando servidor Zotero final...');
console.log('📁 Zotero:', ZOTERO_DIR);
console.log('📚 Biblioteca:', BIBLIOTECA_DIR);
console.log('🌐 Web:', WEB_DIR);

// Middleware
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Estado global
let zoteroItems = [];
let pdfTextIndex = new Map();
let indexingQueue = [];
let isIndexing = false;
let folderStructure = null;
let compactStats = { folders: 0, pdfs: 0, indexed: 0 };

// WebSocket para sincronización en tiempo real
const wss = new WebSocket.Server({ port: 3002 });
console.log('📡 WebSocket servidor en puerto 3002');

function broadcastToClients(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Cargar base de datos Zotero
async function loadZoteroDatabase() {
    try {
        const dbPath = path.join(ZOTERO_DIR, 'zotero.sqlite');
        console.log('📖 Conectando base de datos:', dbPath);
        
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
        
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    i.itemID,
                    i.key,
                    COALESCE(iv.value, 'Sin título') as title,
                    it.typeName as itemType
                FROM items i
                LEFT JOIN itemData id ON i.itemID = id.itemID
                LEFT JOIN itemDataValues iv ON id.valueID = iv.valueID
                LEFT JOIN fields f ON id.fieldID = f.fieldID AND f.fieldName = 'title'
                LEFT JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
                WHERE i.itemTypeID NOT IN (1, 14)
                ORDER BY COALESCE(iv.value, 'Sin título') ASC
            `;
            
            db.all(query, [], async (err, rows) => {
                if (err) {
                    console.error('❌ Error consultando base de datos:', err);
                    reject(err);
                    return;
                }
                
                console.log(`📚 Encontrados ${rows.length} elementos en Zotero`);
                
                const items = await Promise.all(rows.map(async row => {
                    const attachments = await findAttachments(row.itemID, db);
                    return {
                        id: row.itemID,
                        key: row.key,
                        title: row.title || 'Sin título',
                        authors: [], // Simplificamos por ahora
                        year: null, // Simplificamos por ahora
                        type: row.itemType || 'unknown',
                        collection: 'Sin colección', // Simplificamos por ahora
                        attachments: attachments
                    };
                }));
                
                db.close();
                resolve(items);
            });
        });
        
    } catch (error) {
        console.error('❌ Error cargando base de datos Zotero:', error);
        throw error;
    }
}

// Encontrar adjuntos de un item
function findAttachments(itemID, db) {
    return new Promise((resolve) => {
        const attachmentQuery = `
            SELECT 
                ia.path,
                ia.contentType,
                iv.value as title
            FROM itemAttachments ia
            JOIN items i ON ia.itemID = i.itemID
            LEFT JOIN itemData id ON i.itemID = id.itemID
            LEFT JOIN fields f ON id.fieldID = f.fieldID AND f.fieldName = 'title'
            LEFT JOIN itemDataValues iv ON id.valueID = iv.valueID
            WHERE ia.parentItemID = ? AND ia.path IS NOT NULL
        `;
        
        db.all(attachmentQuery, [itemID], (err, attachments) => {
            if (err) {
                console.error('❌ Error consultando adjuntos:', err);
                resolve([]);
                return;
            }
            
            const processedAttachments = attachments.map(att => {
                let fullPath = att.path;
                if (fullPath.startsWith('storage:')) {
                    // Ruta de storage por defecto
                    const fileName = fullPath.replace('storage:', '');
                    fullPath = `/storage/${fileName}`;
                } else if (fullPath.startsWith('attachments:')) {
                    // Ruta en biblioteca personalizada
                    const relativePath = fullPath.replace('attachments:', '');
                    fullPath = `/biblioteca/${relativePath}`;
                }
                
                return {
                    originalPath: att.path,
                    path: fullPath,
                    title: att.title || path.basename(fullPath),
                    fileName: path.basename(fullPath),
                    isPDF: att.contentType === 'application/pdf' || fullPath.toLowerCase().endsWith('.pdf'),
                    contentType: att.contentType
                };
            });
            
            resolve(processedAttachments);
        });
    });
}

// Cargar índice de texto PDF
async function loadPDFTextIndex() {
    try {
        const indexData = await fs.readFile(PDF_INDEX_FILE, 'utf8');
        const parsed = JSON.parse(indexData);
        pdfTextIndex = new Map(parsed.entries || []);
        console.log(`📖 Cargado índice de texto con ${pdfTextIndex.size} PDFs`);
    } catch (error) {
        console.log('📝 Creando nuevo índice de texto PDF');
        pdfTextIndex = new Map();
        await savePDFTextIndex();
    }
}

// Guardar índice de texto PDF
async function savePDFTextIndex() {
    try {
        const indexData = {
            lastUpdate: new Date().toISOString(),
            entries: Array.from(pdfTextIndex.entries())
        };
        await fs.writeFile(PDF_INDEX_FILE, JSON.stringify(indexData, null, 2));
    } catch (error) {
        console.error('❌ Error guardando índice PDF:', error);
    }
}

// Extraer texto de PDF
async function extractTextFromPDF(pdfPath) {
    return new Promise((resolve) => {
        // Intentar primero con pdftotext
        exec(`pdftotext "${pdfPath}" -`, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout) => {
            if (!error && stdout.trim()) {
                resolve({
                    text: stdout.trim(),
                    method: 'pdftotext',
                    wordCount: stdout.trim().split(/\s+/).length
                });
                return;
            }
            
            // Si falla, intentar OCR con tesseract
            exec(`pdftoppm "${pdfPath}" | tesseract - - -l spa`, { 
                maxBuffer: 1024 * 1024 * 10,
                timeout: 60000 
            }, (ocrError, ocrStdout) => {
                if (!ocrError && ocrStdout.trim()) {
                    resolve({
                        text: ocrStdout.trim(),
                        method: 'OCR',
                        wordCount: ocrStdout.trim().split(/\s+/).length
                    });
                } else {
                    resolve({
                        text: '',
                        method: 'failed',
                        wordCount: 0,
                        error: error?.message || ocrError?.message
                    });
                }
            });
        });
    });
}

// Procesar cola de indexación
async function processIndexingQueue() {
    if (isIndexing || indexingQueue.length === 0) return;
    
    isIndexing = true;
    const batchSize = 10; // Procesar en lotes pequeños
    console.log(`📖 Procesando cola de indexación: ${indexingQueue.length} PDFs (lote de ${batchSize})`);
    
    let processed = 0;
    while (indexingQueue.length > 0 && processed < batchSize) {
        const pdfInfo = indexingQueue.shift();
        
        try {
            if (!pdfTextIndex.has(pdfInfo.path)) {
                console.log(`📄 Indexando: ${pdfInfo.fileName}`);
                const textData = await extractTextFromPDF(pdfInfo.fullPath);
                
                pdfTextIndex.set(pdfInfo.path, {
                    ...textData,
                    fileName: pdfInfo.fileName,
                    lastIndexed: new Date().toISOString(),
                    relativePath: pdfInfo.path
                });
                
                await savePDFTextIndex();
                await updateCompactStats();
            }
        } catch (error) {
            console.error(`❌ Error indexando ${pdfInfo.fileName}:`, error.message);
        }
        
        processed++;
        // Limitar CPU más agresivamente
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    isIndexing = false;
    
    if (indexingQueue.length > 0) {
        console.log(`⏸️  Procesamiento pausado. Quedan ${indexingQueue.length} PDFs. Continuando en 30 segundos...`);
        setTimeout(() => {
            processIndexingQueue();
        }, 30000);
    } else {
        console.log('✅ Cola de indexación completada');
    }
}

// Escanear PDFs en biblioteca
async function scanPDFsInBiblioteca(dir = BIBLIOTECA_DIR, relativePath = '') {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.join(relativePath, entry.name);
            
            if (entry.isDirectory()) {
                await scanPDFsInBiblioteca(fullPath, relPath);
            } else if (entry.name.toLowerCase().endsWith('.pdf')) {
                if (!pdfTextIndex.has(relPath)) {
                    indexingQueue.push({
                        path: relPath,
                        fullPath: fullPath,
                        fileName: entry.name
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Error escaneando PDFs:', error);
    }
}

// Construir estructura de carpetas
async function buildFolderStructure(dir = BIBLIOTECA_DIR, relativePath = '') {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const structure = {
            name: path.basename(dir),
            path: relativePath || '/',
            children: [],
            files: [],
            totalPdfs: 0
        };
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.join(relativePath, entry.name);
            
            if (entry.isDirectory()) {
                const child = await buildFolderStructure(fullPath, relPath);
                structure.children.push(child);
                structure.totalPdfs += child.totalPdfs;
            } else {
                const isPdf = entry.name.toLowerCase().endsWith('.pdf');
                structure.files.push({
                    name: entry.name,
                    path: relPath,
                    isPdf: isPdf
                });
                
                if (isPdf) structure.totalPdfs++;
            }
        }
        
        return structure;
    } catch (error) {
        console.error('❌ Error construyendo estructura:', error);
        return { name: 'Error', path: '/', children: [], files: [], totalPdfs: 0 };
    }
}

// Actualizar estadísticas compactas
async function updateCompactStats() {
    try {
        // Contar carpetas
        async function countFolders(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            let count = 0;
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    count++;
                    count += await countFolders(path.join(dir, entry.name));
                }
            }
            return count;
        }
        
        // Contar PDFs
        async function countPDFs(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            let count = 0;
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    count += await countPDFs(path.join(dir, entry.name));
                } else if (entry.name.toLowerCase().endsWith('.pdf')) {
                    count++;
                }
            }
            return count;
        }
        
        compactStats = {
            folders: await countFolders(BIBLIOTECA_DIR),
            pdfs: await countPDFs(BIBLIOTECA_DIR),
            indexed: pdfTextIndex.size
        };
        
        console.log('📊 Estadísticas actualizadas:', compactStats);
    } catch (error) {
        console.error('❌ Error actualizando estadísticas:', error);
    }
}

// API Endpoints

// Estadísticas compactas
app.get('/api/compact-stats', (req, res) => {
    res.json(compactStats);
});

// Biblioteca principal
app.get('/api/library', (req, res) => {
    res.json(zoteroItems);
});

// Estado de indexación
app.get('/api/indexing-status', (req, res) => {
    res.json({
        indexing: {
            active: isIndexing,
            queueLength: indexingQueue.length,
            totalIndexed: pdfTextIndex.size
        }
    });
});

// Estructura de carpetas
app.get('/api/folder-tree', async (req, res) => {
    try {
        if (!folderStructure) {
            folderStructure = await buildFolderStructure();
        }
        res.json(folderStructure);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Búsqueda en carpetas
app.get('/api/search-folders/:query', async (req, res) => {
    try {
        const query = req.params.query.toLowerCase();
        const results = [];
        
        async function searchInDir(dir, relativePath = '') {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relPath = path.join(relativePath, entry.name);
                
                if (entry.name.toLowerCase().includes(query)) {
                    results.push({
                        name: entry.name,
                        path: relPath,
                        folder: path.dirname(relPath) || '/',
                        type: entry.isDirectory() ? 'folder' : 'file',
                        isPdf: entry.name.toLowerCase().endsWith('.pdf')
                    });
                }
                
                if (entry.isDirectory()) {
                    await searchInDir(fullPath, relPath);
                }
            }
        }
        
        await searchInDir(BIBLIOTECA_DIR);
        res.json(results.slice(0, 50)); // Limitar resultados
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Búsqueda de texto en PDFs
app.get('/api/search-text/:query', (req, res) => {
    const query = req.params.query.toLowerCase();
    const results = [];
    
    pdfTextIndex.forEach((data, pdfPath) => {
        if (data.text && data.text.toLowerCase().includes(query)) {
            const contextStart = Math.max(0, data.text.toLowerCase().indexOf(query) - 100);
            const contextEnd = Math.min(data.text.length, contextStart + 300);
            
            results.push({
                fileName: data.fileName,
                relativePath: data.relativePath,
                context: data.text.substring(contextStart, contextEnd),
                method: data.method,
                wordCount: data.wordCount
            });
        }
    });
    
    res.json(results.slice(0, 20)); // Limitar resultados
});

// Forzar escaneo de PDFs
app.post('/api/scan-pdfs', async (req, res) => {
    try {
        await scanPDFsInBiblioteca();
        processIndexingQueue(); // No esperar
        res.json({ message: 'Escaneo iniciado en segundo plano', queueLength: indexingQueue.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualización forzada
app.post('/api/sync/force-update', async (req, res) => {
    try {
        console.log('🔄 Iniciando actualización forzada...');
        
        // Recargar datos
        zoteroItems = await loadZoteroDatabase();
        folderStructure = await buildFolderStructure();
        await updateCompactStats();
        
        // Notificar clientes
        broadcastToClients({
            type: 'force_update',
            message: 'Actualización forzada completada',
            data: {
                library: zoteroItems,
                stats: compactStats
            }
        });
        
        res.json({ 
            message: 'Actualización completada',
            items: zoteroItems.length,
            stats: compactStats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Servir archivos de biblioteca
app.use('/biblioteca', express.static(BIBLIOTECA_DIR, {
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline');
        }
    }
}));

// Servir archivos de storage de Zotero
app.use('/storage', express.static(path.join(ZOTERO_DIR, 'storage'), {
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline');
        }
    }
}));

// Servir frontend
app.use(express.static(WEB_DIR));

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// Configurar watchers para sincronización (DESACTIVADO por limitaciones del sistema)
function setupFileWatchers() {
    console.log('⚠️  File watchers desactivados para evitar sobrecarga del sistema');
    console.log('💡 Usa el botón "Actualizar" para sincronizar manualmente');
    
    /* CÓDIGO DE WATCHERS DESACTIVADO
    // Watcher para base de datos Zotero
    const dbWatcher = chokidar.watch(path.join(ZOTERO_DIR, 'zotero.sqlite'), {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 2000 }
    });
    
    dbWatcher.on('change', async () => {
        console.log('📝 Base de datos Zotero modificada');
        try {
            zoteroItems = await loadZoteroDatabase();
            await updateCompactStats();
            
            broadcastToClients({
                type: 'database_update',
                message: 'Base de datos Zotero actualizada',
                data: { library: zoteroItems, stats: compactStats }
            });
        } catch (error) {
            console.error('❌ Error recargando base de datos:', error);
        }
    });
    
    // Watcher para archivos de biblioteca (limitado a primeros niveles)
    const bibliotecaWatcher = chokidar.watch(BIBLIOTECA_DIR, {
        ignoreInitial: true,
        ignored: /(^|[\/\\])\../, // Ignorar archivos ocultos
        depth: 5, // Limitar profundidad
        usePolling: false,
        interval: 2000
    });
    
    bibliotecaWatcher.on('add', async (filePath) => {
        if (filePath.toLowerCase().endsWith('.pdf')) {
            console.log('📄 PDF agregado:', path.basename(filePath));
            const relativePath = path.relative(BIBLIOTECA_DIR, filePath);
            
            indexingQueue.push({
                path: relativePath,
                fullPath: filePath,
                fileName: path.basename(filePath)
            });
            
            processIndexingQueue();
            folderStructure = null; // Resetear para reconstruir
            await updateCompactStats();
            
            broadcastToClients({
                type: 'file_change',
                action: 'add',
                file: path.basename(filePath),
                message: `PDF agregado: ${path.basename(filePath)}`
            });
        }
    });
    
    bibliotecaWatcher.on('unlink', async (filePath) => {
        if (filePath.toLowerCase().endsWith('.pdf')) {
            console.log('📄 PDF eliminado:', path.basename(filePath));
            const relativePath = path.relative(BIBLIOTECA_DIR, filePath);
            
            pdfTextIndex.delete(relativePath);
            await savePDFTextIndex();
            folderStructure = null; // Resetear para reconstruir
            await updateCompactStats();
            
            broadcastToClients({
                type: 'file_change',
                action: 'remove',
                file: path.basename(filePath),
                message: `PDF eliminado: ${path.basename(filePath)}`
            });
        }
    });
    
    console.log('👀 Watchers configurados para sincronización en tiempo real');
    */
}

// Inicialización del servidor
async function initializeServer() {
    try {
        console.log('🚀 Inicializando servidor...');
        
        // Verificar directorios
        await fs.access(ZOTERO_DIR);
        await fs.access(BIBLIOTECA_DIR);
        console.log('✅ Directorios verificados');
        
        // Cargar datos iniciales
        await loadPDFTextIndex();
        zoteroItems = await loadZoteroDatabase();
        folderStructure = await buildFolderStructure();
        await updateCompactStats();
        
        // Escanear PDFs para indexación
        await scanPDFsInBiblioteca();
        processIndexingQueue(); // Iniciar en segundo plano
        
        // Configurar watchers
        setupFileWatchers();
        
        // Configurar WebSocket
        wss.on('connection', (ws) => {
            console.log('👤 Cliente WebSocket conectado');
            
            // Enviar datos iniciales
            ws.send(JSON.stringify({
                type: 'initial',
                message: 'Conexión establecida',
                data: {
                    library: zoteroItems,
                    stats: compactStats
                }
            }));
            
            ws.on('close', () => {
                console.log('👤 Cliente WebSocket desconectado');
            });
        });
        
        console.log('✅ Servidor inicializado correctamente');
        console.log(`📊 Estadísticas: ${compactStats.folders} carpetas, ${compactStats.pdfs} PDFs, ${compactStats.indexed} indexados`);
        
    } catch (error) {
        console.error('❌ Error inicializando servidor:', error);
        process.exit(1);
    }
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor ejecutándose en puerto ${PORT}`);
    console.log(`📍 Acceso local: http://localhost:${PORT}`);
    console.log(`🌍 Acceso remoto: http://0.0.0.0:${PORT}`);
    
    initializeServer();
});

// Manejo de señales de cierre
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    await savePDFTextIndex();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Cerrando servidor...');
    await savePDFTextIndex();
    process.exit(0);
});