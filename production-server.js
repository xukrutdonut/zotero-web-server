const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const { exec } = require('child_process');
const EventEmitter = require('events');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 8080;

// Event emitter para sincronización
const syncEmitter = new EventEmitter();

// Configuración de directorios
const WEB_DIR = path.join(__dirname, 'web');
const STORAGE_DIR = '/home/arkantu/Zotero/storage';
const BIBLIOTECA_DIR = '/home/arkantu/Documentos/Zotero Biblioteca';
const ZOTERO_DB = '/home/arkantu/Zotero/zotero.sqlite';
const PDF_INDEX_FILE = path.join(__dirname, 'pdf-text-index.json');

// API Key para servicios ocultos (genera una aleatoria si no existe)
const API_KEY = process.env.ZOTERO_API_KEY || 'zotero-' + Math.random().toString(36).substring(2, 15);
console.log(`🔐 API Key para servicios ocultos: ${API_KEY}`);

console.log('🌐 Iniciando servidor Zotero de producción...');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(WEB_DIR));

// Middleware para servicios ocultos
const requireApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'API key requerida para este servicio' });
    }
    next();
};

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
        console.log(`💾 Índice guardado: ${Object.keys(pdfTextIndex).length} PDFs`);
    } catch (error) {
        console.error('Error guardando índice:', error);
    }
}

// Función para extraer texto de PDF
function extractPDFText(pdfPath, callback) {
    const fileName = path.basename(pdfPath);
    
    // Intentar con pdftotext primero
    exec(`pdftotext "${pdfPath}" -`, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout) => {
        if (!error && stdout.trim().length > 50) {
            console.log(`✅ Texto extraído de ${fileName} (${stdout.length} caracteres)`);
            callback(null, stdout);
            return;
        }
        
        console.log(`OCR no disponible para ${fileName} (falta pdftotext o tesseract)`);
        callback(null, '');
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
        
        stats.isIndexing = false;
        
        // Emitir actualización por WebSocket
        io.emit('indexing-progress', {
            indexed: stats.indexedPDFs,
            total: stats.totalPDFs,
            current: path.basename(currentIndexing || '')
        });
        
        setTimeout(processIndexingQueue, 2000); // Pausa de 2s entre indexaciones
    });
}

// Función para añadir PDFs a la cola de indexación
function addToIndexingQueue(pdfPath) {
    if (!pdfTextIndex[pdfPath] && !indexingQueue.includes(pdfPath)) {
        indexingQueue.push(pdfPath);
        setTimeout(processIndexingQueue, 100);
    }
}

// API para obtener estadísticas
app.get('/api/stats', (req, res) => {
    const currentStats = {
        ...stats,
        indexedPDFs: Object.keys(pdfTextIndex).length,
        queueLength: indexingQueue.length,
        currentFile: currentIndexing ? path.basename(currentIndexing) : null
    };
    res.json(currentStats);
});

// API para acceso directo a PDFs
app.get('/biblioteca/*', async (req, res) => {
    try {
        const relativePath = req.params[0];
        const fullPath = path.join(BIBLIOTECA_DIR, relativePath);
        
        console.log(`📖 Solicitando PDF: ${relativePath}`);
        
        // Verificar que el archivo existe
        if (!fs.existsSync(fullPath)) {
            console.log(`❌ Archivo no encontrado: ${fullPath}`);
            return res.status(404).json({ error: 'PDF no encontrado' });
        }
        
        // Verificar que es un PDF
        if (path.extname(fullPath).toLowerCase() !== '.pdf') {
            console.log(`❌ Tipo de archivo no válido: ${fullPath}`);
            return res.status(400).json({ error: 'Solo se permiten archivos PDF' });
        }
        
        // Verificar el tamaño del archivo
        const stats = fs.statSync(fullPath);
        console.log(`📊 Tamaño del archivo: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Si el archivo es muy grande (>50MB), devolver enlace de descarga
        if (stats.size > 50 * 1024 * 1024) {
            console.log(`⚠️ Archivo muy grande, redirigiendo descarga: ${path.basename(fullPath)}`);
            return res.json({ 
                message: 'Archivo muy grande para visualizar en línea',
                downloadUrl: `/biblioteca/${relativePath}?download=1`,
                size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
            });
        }
        
        // Configurar headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', req.query.download ? 'attachment' : 'inline');
        res.setHeader('Content-Length', stats.size);
        
        // Servir el archivo
        res.sendFile(fullPath, (err) => {
            if (err) {
                console.error(`❌ Error sirviendo PDF ${relativePath}:`, err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error interno del servidor' });
                }
            } else {
                console.log(`✅ PDF servido exitosamente: ${path.basename(fullPath)}`);
            }
        });
        
    } catch (error) {
        console.error(`❌ Error en /biblioteca/*:`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
});

// API OCULTA para ChatGPT - obtener referencias bibliográficas (requiere API key)
app.get('/api/hidden/bibliography', requireApiKey, (req, res) => {
    try {
        console.log('🤖 Acceso de ChatGPT a bibliografía');
        
        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error abriendo base de datos:', err);
                return res.status(500).json({ error: 'Error accediendo a la base de datos de Zotero' });
            }
        });
        
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
                iv3.value as publication
            FROM items i
            JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
            LEFT JOIN itemData id ON i.itemID = id.itemID
            LEFT JOIN itemDataValues iv ON id.valueID = iv.valueID AND id.fieldID = 1
            LEFT JOIN itemData id2 ON i.itemID = id2.itemID AND id2.fieldID = 14
            LEFT JOIN itemDataValues iv2 ON id2.valueID = iv2.valueID
            LEFT JOIN itemData id3 ON i.itemID = id3.itemID AND id3.fieldID = 12
            LEFT JOIN itemDataValues iv3 ON id3.valueID = iv3.valueID
            LEFT JOIN itemCreators ic ON i.itemID = ic.itemID
            LEFT JOIN creators c ON ic.creatorID = c.creatorID
            WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
            GROUP BY i.itemID
            ORDER BY iv.value
            LIMIT 100
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
                type: row.itemType || 'Desconocido',
                authors: row.authors || 'Autor desconocido',
                date: row.date || 'Fecha desconocida',
                publication: row.publication || ''
            }));
            
            console.log(`📚 Enviando ${bibliography.length} referencias a ChatGPT`);
            res.json({
                count: bibliography.length,
                items: bibliography,
                message: 'Bibliografía obtenida exitosamente'
            });
        });
        
    } catch (error) {
        console.error('Error en API de bibliografía:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

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
                try {
                    items.push({
                        name: folder.name,
                        type: 'folder',
                        path: relPath,
                        children: buildTree(fullPath, relPath)
                    });
                } catch (err) {
                    console.error(`Error leyendo carpeta ${fullPath}:`, err.message);
                }
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
        res.json(tree);
        
    } catch (error) {
        console.error('Error construyendo árbol de carpetas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Resto de las APIs existentes...
app.get('/api/items', (req, res) => {
    try {
        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY);
        
        const query = `
            SELECT 
                i.itemID,
                i.key,
                iv.value as title,
                it.typeName,
                GROUP_CONCAT(DISTINCT c.firstName || ' ' || c.lastName) as authors,
                iv2.value as date,
                iv3.value as publication,
                ia.path as attachmentPath
            FROM items i
            JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
            LEFT JOIN itemData id ON i.itemID = id.itemID
            LEFT JOIN itemDataValues iv ON id.valueID = iv.valueID AND id.fieldID = 1
            LEFT JOIN itemData id2 ON i.itemID = id2.itemID AND id2.fieldID = 14
            LEFT JOIN itemDataValues iv2 ON id2.valueID = iv2.valueID
            LEFT JOIN itemData id3 ON i.itemID = id3.itemID AND id3.fieldID = 12
            LEFT JOIN itemDataValues iv3 ON id3.valueID = iv3.valueID
            LEFT JOIN itemCreators ic ON i.itemID = ic.itemID
            LEFT JOIN creators c ON ic.creatorID = c.creatorID
            LEFT JOIN itemAttachments ia ON i.itemID = ia.parentItemID AND ia.contentType = 'application/pdf'
            WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
            GROUP BY i.itemID
            ORDER BY iv.value
            LIMIT 1000
        `;
        
        db.all(query, [], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Error consultando elementos:', err);
                return res.status(500).json({ error: err.message });
            }
            
            stats.totalItems = rows.length;
            res.json(rows);
        });
        
    } catch (error) {
        console.error('Error en API de elementos:', error);
        res.status(500).json({ error: error.message });
    }
});

// API para buscar en PDFs
app.get('/api/search-pdfs', (req, res) => {
    try {
        const searchTerm = req.query.q?.toLowerCase().trim();
        
        if (!searchTerm) {
            return res.json([]);
        }
        
        const results = [];
        
        for (const [filePath, data] of Object.entries(pdfTextIndex)) {
            if (data.text && data.text.toLowerCase().includes(searchTerm)) {
                const lines = data.text.split('\n');
                const matchingLines = lines.filter(line => 
                    line.toLowerCase().includes(searchTerm)
                ).slice(0, 3);
                
                results.push({
                    file: path.basename(filePath),
                    path: path.relative(BIBLIOTECA_DIR, filePath),
                    matches: matchingLines.length,
                    context: matchingLines,
                    indexed: data.indexed,
                    size: data.size
                });
            }
        }
        
        results.sort((a, b) => b.matches - a.matches);
        res.json(results.slice(0, 50));
        
    } catch (error) {
        console.error('Error buscando en PDFs:', error);
        res.status(500).json({ error: error.message });
    }
});

// WebSocket para sincronización en tiempo real
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    
    // Enviar estadísticas iniciales
    socket.emit('stats-update', stats);
    
    socket.on('request-update', () => {
        socket.emit('stats-update', stats);
    });
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Sincronización con eventos
syncEmitter.on('stats-update', () => {
    io.emit('stats-update', stats);
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
            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                items.forEach(item => {
                    if (item.isDirectory()) {
                        count += countFiles(path.join(dir, item.name));
                    } else if (item.isFile() && path.extname(item.name).toLowerCase() === '.pdf') {
                        count++;
                        const fullPath = path.join(dir, item.name);
                        addToIndexingQueue(fullPath);
                    }
                });
            } catch (err) {
                console.error(`Error leyendo directorio ${dir}:`, err.message);
            }
            return count;
        };
        
        stats.totalPDFs = countFiles(BIBLIOTECA_DIR);
        stats.indexedPDFs = Object.keys(pdfTextIndex).length;
        
        console.log(`📊 Encontrados ${stats.totalPDFs} PDFs, ${stats.indexedPDFs} indexados`);
    } catch (error) {
        console.error('Error contando archivos:', error);
    }
    
    // File watchers deshabilitados para evitar ENOSPC
    console.log('⚠️ File watchers deshabilitados para evitar límite del sistema. Usa el botón "Actualizar" para sincronizar.');
    
    // Iniciar procesamiento de cola
    setTimeout(processIndexingQueue, 2000);
    
    console.log(`🌟 Servidor iniciado en http://localhost:${PORT}`);
    console.log(`📁 Biblioteca: ${BIBLIOTECA_DIR}`);
    console.log(`🗄️ Storage: ${STORAGE_DIR}`);
    console.log(`🔐 API Key: ${API_KEY}`);
}

// Manejo de errores
process.on('SIGINT', () => {
    console.log('\n⏹️ Deteniendo servidor...');
    savePDFIndex();
    stats.isIndexing = false;
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    savePDFIndex();
    process.exit(1);
});

// Iniciar servidor
server.listen(PORT, () => {
    initialize();
});

module.exports = app;