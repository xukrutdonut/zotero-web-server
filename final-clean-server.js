#!/usr/bin/env node

/**
 * Servidor Zotero Web - Versión Final Limpia
 * NeuropediaLab - 2025
 * 
 * Servidor web profesional para acceder y buscar en biblioteca de documentos Zotero
 * Con indexación de texto completo y APIs ocultas para servicios de IA
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { exec } = require('child_process');
const EventEmitter = require('events');
const http = require('http');
const socketIo = require('socket.io');
const chokidar = require('chokidar');

// Configuración del servidor
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 8080;

// Event emitter para sincronización
const syncEmitter = new EventEmitter();

// Configuración de directorios
const WEB_DIR = path.join(__dirname, 'web');
const BIBLIOTECA_DIR = process.env.BIBLIOTECA_DIR || '/home/arkantu/Documentos/Zotero Biblioteca';
const ZOTERO_DB = process.env.ZOTERO_DB || '/home/arkantu/Zotero/zotero.sqlite';
const PDF_INDEX_FILE = path.join(__dirname, 'pdf-text-index.json');

// API Key para servicios ocultos
const API_KEY = process.env.ZOTERO_API_KEY || generateApiKey();

function generateApiKey() {
    const key = 'zotero-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    console.log(`🔐 Nueva API Key generada: ${key}`);
    console.log(`📋 Para servicios ocultos, usar header: X-API-Key: ${key}`);
    return key;
}

console.log('🌐 Iniciando servidor Zotero de producción...');
console.log(`📁 Biblioteca: ${BIBLIOTECA_DIR}`);
console.log(`📊 Base de datos: ${ZOTERO_DB}`);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(WEB_DIR));

// Middleware para servicios ocultos
const requireApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey !== API_KEY) {
        console.log(`🚫 Acceso denegado - API key inválida: ${apiKey}`);
        return res.status(401).json({ 
            error: 'API key requerida para este servicio',
            hint: 'Usar header X-API-Key o parámetro api_key'
        });
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
    isIndexing: false,
    indexingProgress: { current: 0, total: 0 },
    currentFile: ''
};

// Índice de texto de PDFs
let pdfTextIndex = {};
let indexingQueue = [];
let currentIndexing = null;

// Cargar índice de texto existente
function loadPDFIndex() {
    try {
        if (fs.existsSync(PDF_INDEX_FILE)) {
            pdfTextIndex = JSON.parse(fs.readFileSync(PDF_INDEX_FILE, 'utf8'));
            console.log(`📚 Cargado índice de ${Object.keys(pdfTextIndex).length} PDFs`);
            updateStats();
        }
    } catch (error) {
        console.error('❌ Error cargando índice PDF:', error);
        pdfTextIndex = {};
    }
}

// Guardar índice de texto
function savePDFIndex() {
    try {
        fs.writeFileSync(PDF_INDEX_FILE, JSON.stringify(pdfTextIndex, null, 2));
        console.log(`💾 Índice guardado: ${Object.keys(pdfTextIndex).length} PDFs`);
    } catch (error) {
        console.error('❌ Error guardando índice:', error);
    }
}

// Extraer texto de PDF usando pdftotext
function extractPDFText(pdfPath, callback) {
    const fileName = path.basename(pdfPath);
    
    exec(`pdftotext "${pdfPath}" -`, { 
        maxBuffer: 1024 * 1024 * 10,
        timeout: 30000 
    }, (error, stdout) => {
        if (!error && stdout.trim().length > 50) {
            console.log(`✅ Texto extraído: ${fileName} (${stdout.length} caracteres)`);
            callback(null, stdout.trim());
        } else {
            console.log(`⚠️  No se pudo extraer texto: ${fileName}`);
            callback(new Error('Sin texto extraíble'), null);
        }
    });
}

// Indexar un PDF
function indexPDF(filePath) {
    return new Promise((resolve, reject) => {
        if (pdfTextIndex[filePath]) {
            resolve(pdfTextIndex[filePath]);
            return;
        }
        
        extractPDFText(filePath, (error, text) => {
            if (error) {
                resolve(null);
                return;
            }
            
            const indexData = {
                path: filePath,
                text: text,
                indexed: Date.now(),
                size: text.length,
                fileName: path.basename(filePath)
            };
            
            pdfTextIndex[filePath] = indexData;
            savePDFIndex();
            resolve(indexData);
        });
    });
}

// Procesador de cola de indexación
async function processIndexingQueue() {
    if (indexingQueue.length === 0 || currentIndexing) {
        return;
    }
    
    currentIndexing = indexingQueue.shift();
    stats.isIndexing = true;
    stats.currentFile = path.basename(currentIndexing);
    
    console.log(`🔍 Indexando: ${currentIndexing}`);
    
    try {
        await indexPDF(currentIndexing);
        stats.indexingProgress.current++;
    } catch (error) {
        console.error(`❌ Error indexando ${currentIndexing}:`, error);
    }
    
    currentIndexing = null;
    updateStats();
    broadcastStats();
    
    // Continuar con el siguiente
    setTimeout(processIndexingQueue, 100);
}

// Buscar en todos los PDFs
function searchInPDFs(query, limit = 50) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const [filePath, indexData] of Object.entries(pdfTextIndex)) {
        if (!indexData || !indexData.text) continue;
        
        const text = indexData.text.toLowerCase();
        const index = text.indexOf(queryLower);
        
        if (index !== -1) {
            const contextStart = Math.max(0, index - 100);
            const contextEnd = Math.min(text.length, index + query.length + 100);
            const context = indexData.text.substring(contextStart, contextEnd);
            
            results.push({
                file: path.basename(filePath),
                path: path.relative(BIBLIOTECA_DIR, filePath),
                context: context,
                score: 1 // Podríamos implementar scoring más sofisticado
            });
        }
        
        if (results.length >= limit) break;
    }
    
    return results.sort((a, b) => b.score - a.score);
}

// Actualizar estadísticas
function updateStats() {
    try {
        const totalPDFs = countPDFsInDirectory(BIBLIOTECA_DIR);
        const indexedPDFs = Object.keys(pdfTextIndex).length;
        
        stats.totalPDFs = totalPDFs;
        stats.indexedPDFs = indexedPDFs;
        stats.lastSync = new Date();
        
        if (indexingQueue.length === 0) {
            stats.isIndexing = false;
            stats.syncStatus = 'Sincronizado';
        } else {
            stats.syncStatus = `Indexando (${stats.indexingProgress.current}/${stats.indexingProgress.total})`;
        }
        
    } catch (error) {
        console.error('❌ Error actualizando estadísticas:', error);
    }
}

// Contar PDFs en directorio recursivamente
function countPDFsInDirectory(dir) {
    let count = 0;
    try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                count += countPDFsInDirectory(fullPath);
            } else if (file.isFile() && path.extname(file.name).toLowerCase() === '.pdf') {
                count++;
            }
        }
    } catch (error) {
        console.error(`❌ Error contando PDFs en ${dir}:`, error);
    }
    return count;
}

// Enviar estadísticas a todos los clientes conectados
function broadcastStats() {
    io.emit('stats-update', stats);
}

// Iniciar indexación completa
function startFullIndexing() {
    console.log('🚀 Iniciando indexación completa...');
    indexingQueue = [];
    
    function addPDFsToQueue(dir) {
        try {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            for (const file of files) {
                const fullPath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    addPDFsToQueue(fullPath);
                } else if (file.isFile() && path.extname(file.name).toLowerCase() === '.pdf') {
                    if (!pdfTextIndex[fullPath]) {
                        indexingQueue.push(fullPath);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error agregando PDFs de ${dir}:`, error);
        }
    }
    
    addPDFsToQueue(BIBLIOTECA_DIR);
    stats.indexingProgress = { current: 0, total: indexingQueue.length };
    
    console.log(`📝 ${indexingQueue.length} PDFs en cola para indexar`);
    processIndexingQueue();
}

// === RUTAS DE LA API ===

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// API para obtener estructura de carpetas
app.get('/api/folder-tree', async (req, res) => {
    try {
        const buildTree = (dir, relativePath = '') => {
            const items = [];
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            // Ordenar carpetas y archivos
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
                    console.error(`❌ Error leyendo carpeta ${fullPath}:`, err.message);
                }
            });
            
            files.forEach(file => {
                const filePath = path.join(relativePath, file.name);
                const fullPath = path.join(dir, file.name);
                items.push({
                    name: file.name,
                    type: 'file',
                    path: filePath,
                    indexed: !!pdfTextIndex[fullPath]
                });
            });
            
            return items;
        };
        
        const tree = buildTree(BIBLIOTECA_DIR);
        res.json({
            success: true,
            tree: tree,
            stats: stats
        });
        
    } catch (error) {
        console.error('❌ Error construyendo árbol de carpetas:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor al cargar estructura' 
        });
    }
});

// API para búsqueda de texto
app.get('/api/search-text', (req, res) => {
    const { query, limit = 50 } = req.query;
    
    if (!query || query.length < 3) {
        return res.json({ results: [] });
    }
    
    try {
        const results = searchInPDFs(query, parseInt(limit));
        res.json({
            success: true,
            query: query,
            results: results,
            total: results.length
        });
    } catch (error) {
        console.error('❌ Error en búsqueda:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error en la búsqueda de texto' 
        });
    }
});

// API para estadísticas
app.get('/api/stats', (req, res) => {
    res.json(stats);
});

// Servir archivos PDF
app.get('/biblioteca/*', async (req, res) => {
    try {
        const relativePath = req.params[0];
        const fullPath = path.join(BIBLIOTECA_DIR, relativePath);
        
        // Verificar que el archivo existe y está dentro del directorio permitido
        if (!fullPath.startsWith(BIBLIOTECA_DIR) || !fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        const stats = fs.statSync(fullPath);
        
        // Verificar tamaño del archivo (máximo 100MB para visualización)
        if (stats.size > 100 * 1024 * 1024 && !req.query.download) {
            return res.json({
                type: 'large-file',
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
                console.log(`✅ PDF servido: ${path.basename(fullPath)}`);
            }
        });
        
    } catch (error) {
        console.error(`❌ Error en /biblioteca/*:`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
});

// === APIS OCULTAS PARA SERVICIOS DE IA ===

// API OCULTA: Obtener bibliografía completa (requiere API key)
app.get('/api/hidden/bibliography', requireApiKey, (req, res) => {
    try {
        console.log('🤖 Acceso autorizado a bibliografía');
        
        // Verificar que la base de datos existe
        if (!fs.existsSync(ZOTERO_DB)) {
            return res.status(404).json({ 
                error: 'Base de datos de Zotero no encontrada',
                path: ZOTERO_DB 
            });
        }
        
        const db = new sqlite3.Database(ZOTERO_DB, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('❌ Error abriendo base de datos:', err);
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
            LIMIT ${req.query.limit || 1000}
        `;
        
        db.all(query, [], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('❌ Error consultando bibliografía:', err);
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
            
            console.log(`📚 Enviando ${bibliography.length} referencias`);
            res.json({
                success: true,
                count: bibliography.length,
                items: bibliography,
                generated: new Date().toISOString()
            });
        });
        
    } catch (error) {
        console.error('❌ Error en API de bibliografía:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// API OCULTA: Búsqueda avanzada en texto completo (requiere API key)
app.get('/api/hidden/search-full', requireApiKey, (req, res) => {
    const { query, limit = 100, format = 'json' } = req.query;
    
    if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Query mínimo de 2 caracteres' });
    }
    
    try {
        console.log(`🤖 Búsqueda avanzada autorizada: "${query}"`);
        const results = searchInPDFs(query, parseInt(limit));
        
        if (format === 'text') {
            // Formato de texto plano para IA
            const textResults = results.map(r => 
                `Archivo: ${r.file}\nRuta: ${r.path}\nContexto: ${r.context}\n---`
            ).join('\n\n');
            
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(textResults);
        } else {
            res.json({
                success: true,
                query: query,
                results: results,
                total: results.length,
                generated: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Error en búsqueda avanzada:', error);
        res.status(500).json({ error: 'Error en la búsqueda avanzada' });
    }
});

// API OCULTA: Obtener texto completo de un archivo (requiere API key)
app.get('/api/hidden/file-content/:path(*)', requireApiKey, (req, res) => {
    try {
        const filePath = req.params.path;
        const fullPath = path.join(BIBLIOTECA_DIR, filePath);
        
        if (!fullPath.startsWith(BIBLIOTECA_DIR) || !fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        const indexData = pdfTextIndex[fullPath];
        if (!indexData || !indexData.text) {
            return res.status(404).json({ 
                error: 'Archivo no indexado o sin texto extraíble',
                indexed: !!indexData
            });
        }
        
        console.log(`🤖 Acceso autorizado al contenido de: ${filePath}`);
        
        const format = req.query.format || 'json';
        if (format === 'text') {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(indexData.text);
        } else {
            res.json({
                success: true,
                file: path.basename(fullPath),
                path: filePath,
                content: indexData.text,
                indexed: indexData.indexed,
                size: indexData.size,
                generated: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Error obteniendo contenido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// === SOCKET.IO PARA TIEMPO REAL ===

io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado');
    
    // Enviar estadísticas iniciales
    socket.emit('stats-update', stats);
    
    socket.on('disconnect', () => {
        console.log('🔌 Cliente desconectado');
    });
});

// === MONITOREO DE ARCHIVOS ===

function initFileWatcher() {
    if (!fs.existsSync(BIBLIOTECA_DIR)) {
        console.log(`⚠️  Directorio de biblioteca no encontrado: ${BIBLIOTECA_DIR}`);
        return;
    }
    
    const watcher = chokidar.watch(BIBLIOTECA_DIR, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true
    });
    
    watcher.on('add', (filePath) => {
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            console.log(`📄 Nuevo PDF: ${path.basename(filePath)}`);
            indexingQueue.push(filePath);
            stats.indexingProgress.total = indexingQueue.length;
            processIndexingQueue();
            io.emit('file-added', { path: path.relative(BIBLIOTECA_DIR, filePath) });
        }
    });
    
    watcher.on('unlink', (filePath) => {
        if (pdfTextIndex[filePath]) {
            delete pdfTextIndex[filePath];
            savePDFIndex();
            console.log(`🗑️  PDF eliminado del índice: ${path.basename(filePath)}`);
            updateStats();
            broadcastStats();
            io.emit('file-removed', { path: path.relative(BIBLIOTECA_DIR, filePath) });
        }
    });
    
    console.log('👀 Monitoreo de archivos iniciado');
}

// === INICIALIZACIÓN ===

function initialize() {
    console.log('🚀 Inicializando servidor...');
    
    // Verificar directorios
    if (!fs.existsSync(WEB_DIR)) {
        console.error(`❌ Directorio web no encontrado: ${WEB_DIR}`);
        process.exit(1);
    }
    
    if (!fs.existsSync(BIBLIOTECA_DIR)) {
        console.log(`⚠️  Creando directorio de biblioteca: ${BIBLIOTECA_DIR}`);
        fs.ensureDirSync(BIBLIOTECA_DIR);
    }
    
    // Cargar índice y iniciar servicios
    loadPDFIndex();
    updateStats();
    initFileWatcher();
    
    // Iniciar indexación si es necesario
    setTimeout(() => {
        startFullIndexing();
    }, 2000);
    
    // Actualizar estadísticas periódicamente
    setInterval(() => {
        updateStats();
        broadcastStats();
    }, 30000);
}

// === INICIO DEL SERVIDOR ===

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎉 ===================================`);
    console.log(`🌐 Servidor Zotero iniciado exitosamente`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`🔐 API Key: ${API_KEY}`);
    console.log(`📁 Biblioteca: ${BIBLIOTECA_DIR}`);
    console.log(`📊 Base de datos: ${ZOTERO_DB}`);
    console.log(`🎉 ===================================\n`);
    
    initialize();
});

// Manejo de errores y señales
process.on('SIGTERM', () => {
    console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
    savePDFIndex();
    server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
    savePDFIndex();
    server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
    savePDFIndex();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    savePDFIndex();
});