const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const { exec } = require('child_process');
const EventEmitter = require('events');
const app = express();
const PORT = 8080;

// Event emitter para sincronización
const syncEmitter = new EventEmitter();

// Configuración de directorios
const WEB_DIR = path.join(__dirname, 'web');
const STORAGE_DIR = '/home/arkantu/Zotero/storage';
const BIBLIOTECA_DIR = '/home/arkantu/Documentos/Zotero Biblioteca';
const ZOTERO_DB = '/home/arkantu/Zotero/zotero.sqlite';
const PDF_INDEX_FILE = path.join(__dirname, 'pdf-text-index.json');

console.log('🌐 Iniciando servidor Zotero mejorado...');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
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

// Índice de texto de PDFs
let pdfTextIndex = {};
let indexingQueue = [];
let currentIndexing = null;
let indexingProgress = { current: 0, total: 0 };

// Cargar índice de texto existente
function loadPDFIndex() {
    try {
        if (fs.existsSync(PDF_INDEX_FILE)) {
            pdfTextIndex = JSON.parse(fs.readFileSync(PDF_INDEX_FILE, 'utf8'));
            console.log(`📚 Cargado índice de ${Object.keys(pdfTextIndex).length} PDFs`);
        }
    } catch (error) {
        console.error('Error cargando índice PDF:', error);
        pdfTextIndex = {};
    }
}

// Guardar índice de texto
function savePDFIndex() {
    try {
        fs.writeFileSync(PDF_INDEX_FILE, JSON.stringify(pdfTextIndex, null, 2));
    } catch (error) {
        console.error('Error guardando índice PDF:', error);
    }
}

// Función para extraer texto de PDF
function extractPDFText(pdfPath, callback) {
    const pdfparse = require('pdf-parse');
    
    fs.readFile(pdfPath, (err, data) => {
        if (err) {
            // Intentar OCR si no se puede leer directamente
            performOCR(pdfPath, callback);
            return;
        }
        
        pdfparse(data).then(result => {
            callback(null, result.text);
        }).catch(() => {
            // Fallback a OCR
            performOCR(pdfPath, callback);
        });
    });
}

// OCR con Tesseract (opcional, requiere instalación)
function performOCR(pdfPath, callback) {
    // Verificar si las herramientas están disponibles
    exec('which pdf2pnm && which tesseract', (error) => {
        if (error) {
            console.log(`OCR no disponible para ${path.basename(pdfPath)} (falta pdf2pnm o tesseract)`);
            callback(null, ''); // Texto vacío si OCR no está disponible
            return;
        }
        
        const outputDir = '/tmp/ocr_' + Date.now();
        
        exec(`mkdir -p ${outputDir} && pdf2pnm "${pdfPath}" "${outputDir}/page" && tesseract "${outputDir}/page-*.pnm" "${outputDir}/output" && cat "${outputDir}/output.txt" && rm -rf "${outputDir}"`, 
            { maxBuffer: 1024 * 1024 * 10 }, // 10MB buffer
            (error, stdout, stderr) => {
                if (error) {
                    console.log(`OCR falló para ${path.basename(pdfPath)}:`, error.message);
                    callback(null, ''); // Texto vacío si OCR falla
                    return;
                }
                callback(null, stdout);
            }
        );
    });
}

// Procesar cola de indexación
async function processIndexingQueue() {
    if (indexingQueue.length === 0 || stats.isIndexing) {
        return;
    }
    
    stats.isIndexing = true;
    currentIndexing = indexingQueue.shift();
    indexingProgress.total = indexingQueue.length + 1;
    indexingProgress.current = 0;
    
    console.log(`🔍 Indexando: ${currentIndexing}`);
    
    extractPDFText(currentIndexing, (err, text) => {
        if (!err && text) {
            pdfTextIndex[currentIndexing] = {
                text: text,
                indexed: new Date(),
                size: text.length
            };
            stats.indexedPDFs++;
        }
        
        indexingProgress.current++;
        currentIndexing = null;
        
        // Guardar cada 10 archivos procesados
        if (stats.indexedPDFs % 10 === 0) {
            savePDFIndex();
        }
        
        setTimeout(processIndexingQueue, 1000); // Pausa de 1s entre indexaciones
    });
}

// Función para añadir PDFs a la cola de indexación
function addToIndexingQueue(pdfPath) {
    if (!pdfTextIndex[pdfPath] && !indexingQueue.includes(pdfPath)) {
        indexingQueue.push(pdfPath);
        setTimeout(processIndexingQueue, 100);
    }
}

// Sincronización con filesystem watcher
function setupFileWatcher() {
    const watcher = chokidar.watch(BIBLIOTECA_DIR, {
        ignored: /[\/\\]\./,
        persistent: true,
        ignoreInitial: false
    });
    
    watcher.on('add', (filePath) => {
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            stats.totalPDFs++;
            addToIndexingQueue(filePath);
            syncEmitter.emit('file-added', filePath);
        }
    });
    
    watcher.on('unlink', (filePath) => {
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            stats.totalPDFs--;
            delete pdfTextIndex[filePath];
            syncEmitter.emit('file-removed', filePath);
        }
    });
    
    stats.syncStatus = 'Sincronizado';
    console.log('👁️ Vigilancia de archivos activa');
}

// API para obtener estructura de carpetas con archivos
app.get('/api/folder-tree', async (req, res) => {
    try {
        const buildTree = (dir, relativePath = '') => {
            const items = [];
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            // Primero las carpetas
            const folders = entries.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
            const files = entries.filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.pdf').sort((a, b) => a.name.localeCompare(b.name));
            
            folders.forEach(folder => {
                const fullPath = path.join(dir, folder.name);
                const relPath = path.join(relativePath, folder.name);
                items.push({
                    name: folder.name,
                    type: 'folder',
                    path: relPath,
                    children: buildTree(fullPath, relPath)
                });
            });
            
            files.forEach(file => {
                const filePath = path.join(relativePath, file.name);
                items.push({
                    name: file.name,
                    type: 'file',
                    path: filePath,
                    indexed: !!pdfTextIndex[path.join(dir, file.name)]
                });
            });
            
            return items;
        };
        
        const tree = buildTree(BIBLIOTECA_DIR);
        res.json({ tree, stats: getStats() });
    } catch (error) {
        console.error('Error building tree:', error);
        res.status(500).json({ error: error.message });
    }
});

// API para búsqueda en textos indexados
app.get('/api/search-text', (req, res) => {
    const { query, limit = 50 } = req.query;
    
    if (!query || query.length < 3) {
        return res.json({ results: [], message: 'Query demasiado corto' });
    }
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    Object.entries(pdfTextIndex).forEach(([filePath, data]) => {
        if (data.text && data.text.toLowerCase().includes(queryLower)) {
            const relativePath = path.relative(BIBLIOTECA_DIR, filePath);
            const contextStart = data.text.toLowerCase().indexOf(queryLower);
            const context = data.text.substring(
                Math.max(0, contextStart - 100),
                Math.min(data.text.length, contextStart + query.length + 100)
            );
            
            results.push({
                file: path.basename(filePath),
                path: relativePath,
                context: context,
                relevance: (data.text.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length
            });
        }
    });
    
    results.sort((a, b) => b.relevance - a.relevance);
    res.json({ results: results.slice(0, limit), total: results.length });
});

// API para estadísticas
app.get('/api/stats', (req, res) => {
    res.json(getStats());
});

function getStats() {
    return {
        ...stats,
        indexingProgress: stats.isIndexing ? indexingProgress : null,
        queueLength: indexingQueue.length,
        currentFile: currentIndexing ? path.basename(currentIndexing) : null
    };
}

// API para acceso directo a PDFs
app.get('/biblioteca/*', (req, res) => {
    const relativePath = req.params[0];
    const fullPath = path.join(BIBLIOTECA_DIR, relativePath);
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).send('PDF no encontrado');
    }
    
    if (path.extname(fullPath).toLowerCase() !== '.pdf') {
        return res.status(400).send('Solo se permiten archivos PDF');
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(fullPath);
});

// API para ChatGPT - obtener referencias bibliográficas
app.get('/api/bibliography', (req, res) => {
    try {
        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY);
        
        const query = `
            SELECT 
                i.itemID,
                i.key,
                iv.value as title,
                CASE 
                    WHEN it.typeName = 'journalArticle' THEN 'Artículo de revista'
                    WHEN it.typeName = 'book' THEN 'Libro'
                    WHEN it.typeName = 'bookSection' THEN 'Capítulo de libro'
                    WHEN it.typeName = 'thesis' THEN 'Tesis'
                    WHEN it.typeName = 'webpage' THEN 'Página web'
                    ELSE it.typeName
                END as itemType,
                GROUP_CONCAT(DISTINCT c.firstName || ' ' || c.lastName) as authors,
                iv2.value as date,
                iv3.value as publication,
                ia.path as attachmentPath
            FROM items i
            JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
            LEFT JOIN itemData id ON i.itemID = id.itemID
            LEFT JOIN itemDataValues iv ON id.valueID = iv.valueID AND id.fieldID = 1  -- title
            LEFT JOIN itemData id2 ON i.itemID = id2.itemID AND id2.fieldID = 14  -- date
            LEFT JOIN itemDataValues iv2 ON id2.valueID = iv2.valueID
            LEFT JOIN itemData id3 ON i.itemID = id3.itemID AND id3.fieldID = 12  -- publication
            LEFT JOIN itemDataValues iv3 ON id3.valueID = iv3.valueID
            LEFT JOIN itemCreators ic ON i.itemID = ic.itemID
            LEFT JOIN creators c ON ic.creatorID = c.creatorID
            LEFT JOIN itemAttachments ia ON i.itemID = ia.parentItemID AND ia.contentType = 'application/pdf'
            WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
            GROUP BY i.itemID
            ORDER BY iv.value
        `;
        
        db.all(query, [], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error consultando bibliografía:', err);
                return res.status(500).json({ error: err.message });
            }
            
            const bibliography = rows.map(row => ({
                id: row.itemID,
                key: row.key,
                title: row.title || 'Sin título',
                type: row.itemType,
                authors: row.authors || 'Sin autor',
                date: row.date || 'Sin fecha',
                publication: row.publication || 'Sin publicación',
                pdfPath: row.attachmentPath,
                hasFullText: row.attachmentPath ? !!pdfTextIndex[path.join(BIBLIOTECA_DIR, row.attachmentPath)] : false
            }));
            
            res.json({ 
                bibliography, 
                total: bibliography.length,
                indexed: bibliography.filter(b => b.hasFullText).length 
            });
        });
    } catch (error) {
        console.error('Error accediendo a base de datos Zotero:', error);
        res.status(500).json({ error: error.message });
    }
});

// WebSocket para actualizaciones en tiempo real
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    
    // Enviar estadísticas actuales
    socket.emit('stats-update', getStats());
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Emisión de estadísticas cada 5 segundos
setInterval(() => {
    io.emit('stats-update', getStats());
}, 5000);

// Eventos de sincronización
syncEmitter.on('file-added', (filePath) => {
    io.emit('file-added', { path: filePath });
    stats.lastSync = new Date();
});

syncEmitter.on('file-removed', (filePath) => {
    io.emit('file-removed', { path: filePath });
    stats.lastSync = new Date();
});

// Inicialización
async function initialize() {
    console.log('🚀 Inicializando servidor...');
    
    // Crear directorios necesarios
    await fs.ensureDir(WEB_DIR);
    
    // Cargar índice existente
    loadPDFIndex();
    
    // Contar archivos iniciales
    try {
        const countFiles = (dir) => {
            let count = 0;
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach(item => {
                if (item.isDirectory()) {
                    count += countFiles(path.join(dir, item.name));
                } else if (path.extname(item.name).toLowerCase() === '.pdf') {
                    count++;
                    addToIndexingQueue(path.join(dir, item.name));
                }
            });
            return count;
        };
        
        stats.totalPDFs = countFiles(BIBLIOTECA_DIR);
        stats.indexedPDFs = Object.keys(pdfTextIndex).length;
        console.log(`📊 Encontrados ${stats.totalPDFs} PDFs, ${stats.indexedPDFs} indexados`);
    } catch (error) {
        console.error('Error contando archivos:', error);
    }
    
    // Configurar vigilancia de archivos
    setupFileWatcher();
    
    // Iniciar procesamiento de cola
    setTimeout(processIndexingQueue, 2000);
    
    console.log(`🌟 Servidor iniciado en http://localhost:${PORT}`);
    console.log(`📁 Biblioteca: ${BIBLIOTECA_DIR}`);
    console.log(`🗄️ Storage: ${STORAGE_DIR}`);
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n⏹️ Deteniendo servidor...');
    savePDFIndex();
    stats.isIndexing = false;
    process.exit(0);
});

// Iniciar servidor
server.listen(PORT, () => {
    initialize();
});

module.exports = app;