const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const ZoteroSyncManager = require('./ZoteroSyncManager');
const PDFIndexingService = require('./PDFIndexingService');
const FolderNavigationService = require('./FolderNavigationService');

const app = express();
const PORT = process.env.PORT || 3000;
const ZOTERO_DATA_DIR = process.env.ZOTERO_DATA_DIR || '/home/arkantu/Zotero';
const ZOTERO_LIBRARY_DIR = process.env.ZOTERO_LIBRARY_DIR || '/home/arkantu/Documentos/Zotero Biblioteca';

// Manejador global para promesas no capturadas
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    console.error('Promesa:', promise);
    // No salir del proceso, solo registrar el error
});

// Middleware
app.use(cors());
app.use(express.json());

// Ruta de la base de datos de Zotero
const ZOTERO_DB_PATH = path.join(ZOTERO_DATA_DIR, 'zotero.sqlite');

class ZoteroAPI {
    constructor() {
        this.initDatabase();
    }
    
    async initDatabase() {
        try {
            // Verificar si existe la base de datos de Zotero
            if (await fs.pathExists(ZOTERO_DB_PATH)) {
                console.log('Base de datos de Zotero encontrada:', ZOTERO_DB_PATH);
                this.db = new sqlite3.Database(ZOTERO_DB_PATH, sqlite3.OPEN_READONLY);
            } else {
                console.log('Base de datos de Zotero no encontrada, usando modo de archivos');
                this.db = null;
            }
        } catch (error) {
            console.error('Error inicializando base de datos:', error);
            this.db = null;
        }
    }
    
    async getLibraryItems() {
        if (this.db) {
            try {
                return await this.getItemsFromDatabase();
            } catch (error) {
                console.error('Error con base de datos (posiblemente Zotero abierto):', error.message);
                console.log('Cambiando a modo de archivos...');
                return await this.getItemsFromFiles();
            }
        } else {
            return await this.getItemsFromFiles();
        }
    }
    
    getItemsFromDatabase() {
        return new Promise((resolve, reject) => {
            // Consulta más simple para obtener los elementos básicos
            const query = `
                SELECT 
                    i.itemID,
                    i.dateAdded,
                    i.dateModified,
                    COALESCE(iv_title.value, 'Sin título') as title,
                    COALESCE(iv_date.value, '') as date,
                    it.typeName
                FROM items i
                LEFT JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
                LEFT JOIN itemData id_title ON i.itemID = id_title.itemID AND id_title.fieldID = (
                    SELECT fieldID FROM fields WHERE fieldName = 'title'
                )
                LEFT JOIN itemDataValues iv_title ON id_title.valueID = iv_title.valueID
                LEFT JOIN itemData id_date ON i.itemID = id_date.itemID AND id_date.fieldID = (
                    SELECT fieldID FROM fields WHERE fieldName = 'date'
                )
                LEFT JOIN itemDataValues iv_date ON id_date.valueID = iv_date.valueID
                WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
                AND it.typeName NOT IN ('attachment', 'note', 'annotation')
                AND it.typeName IS NOT NULL
                ORDER BY i.dateAdded DESC
                LIMIT 50
            `;
            
            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('Error consultando base de datos:', err);
                    reject(err);
                } else {
                    // Para cada elemento, buscar autores y attachments por separado
                    Promise.all(rows.map(row => this.enrichItem(row)))
                        .then(items => resolve(items))
                        .catch(reject);
                }
            });
        });
    }
    
    enrichItem(item) {
        return new Promise((resolve) => {
            // Buscar autores
            const authorsQuery = `
                SELECT c.firstName, c.lastName
                FROM itemCreators ic
                JOIN creators c ON ic.creatorID = c.creatorID
                WHERE ic.itemID = ?
                ORDER BY ic.orderIndex
            `;
            
            this.db.all(authorsQuery, [item.itemID], (err, authors) => {
                const authorNames = authors && authors.length > 0 
                    ? authors.map(a => `${a.firstName || ''} ${a.lastName || ''}`.trim()).filter(Boolean).join('; ')
                    : 'Autor desconocido';
                
                // Buscar attachments (PDFs)
                const attachQuery = `
                    SELECT ia.path, ia.itemID as attachmentID
                    FROM items child
                    JOIN itemAttachments ia ON child.itemID = ia.itemID
                    WHERE child.parentItemID = ? AND ia.path IS NOT NULL
                    ORDER BY ia.dateAdded DESC
                `;
                
                this.db.all(attachQuery, [item.itemID], (err, attachments) => {
                    let pdfPath = null;
                    let allAttachments = [];
                    
                    if (attachments && attachments.length > 0) {
                        attachments.forEach(att => {
                            if (att.path) {
                                // Los attachments en Zotero usan el formato "storage:archivo.pdf"
                                // Esto apunta a ZOTERO_LIBRARY_DIR (configurado por el usuario)
                                if (att.path.startsWith('storage:')) {
                                    const fileName = att.path.replace('storage:', '');
                                    const fullPath = `/library/${encodeURIComponent(fileName)}`;
                                    
                                    allAttachments.push({
                                        id: att.attachmentID,
                                        path: fullPath,
                                        fileName: fileName,
                                        isPDF: fileName.toLowerCase().endsWith('.pdf'),
                                        source: 'zotero-library'
                                    });
                                    
                                    // Usar el primer PDF como principal
                                    if (!pdfPath && fileName.toLowerCase().endsWith('.pdf')) {
                                        pdfPath = fullPath;
                                    }
                                } else {
                                    // Para attachments que apuntan a storage/ (legacy)
                                    const relativePath = att.path.startsWith('storage:') ? att.path.replace('storage:', '') : att.path;
                                    const fullPath = `/storage/${relativePath}`;
                                    const fileName = relativePath.split('/').pop() || relativePath;
                                    
                                    allAttachments.push({
                                        id: att.attachmentID,
                                        path: fullPath,
                                        fileName: fileName,
                                        isPDF: fileName.toLowerCase().endsWith('.pdf'),
                                        source: 'zotero-storage'
                                    });
                                    
                                    if (!pdfPath && fileName.toLowerCase().endsWith('.pdf')) {
                                        pdfPath = fullPath;
                                    }
                                }
                            }
                        });
                    }
                    
                    resolve({
                        id: item.itemID,
                        title: item.title,
                        authors: authorNames,
                        year: this.extractYear(item.date),
                        dateAdded: item.dateAdded,
                        type: item.typeName,
                        pdfPath: pdfPath,
                        attachments: allAttachments,
                        hasAttachments: allAttachments.length > 0
                    });
                });
            });
        });
    }
    
    async getItemsFromFiles() {
        try {
            const storageDir = path.join(ZOTERO_DATA_DIR, 'storage');
            
            if (!(await fs.pathExists(storageDir))) {
                return [];
            }
            
            console.log('Leyendo items desde archivos del storage...');
            const items = [];
            const dirs = await fs.readdir(storageDir);
            
            // Procesar solo una muestra para evitar sobrecarga
            const sampleDirs = dirs.slice(0, 100);
            
            for (const dir of sampleDirs) {
                const dirPath = path.join(storageDir, dir);
                try {
                    const stat = await fs.stat(dirPath);
                    
                    if (stat.isDirectory()) {
                        const files = await fs.readdir(dirPath);
                        const attachments = [];
                        
                        // Procesar todos los archivos de la carpeta
                        files.forEach(file => {
                            const isPDF = file.toLowerCase().endsWith('.pdf');
                            const isImage = /\.(jpg|jpeg|png|gif|svg)$/i.test(file);
                            const isDoc = /\.(doc|docx|txt|html)$/i.test(file);
                            
                            if (isPDF || isImage || isDoc) {
                                attachments.push({
                                    id: `${dir}_${file}`,
                                    path: `/storage/${dir}/${encodeURIComponent(file)}`,
                                    fileName: file,
                                    isPDF: isPDF,
                                    isImage: isImage,
                                    isDocument: isDoc,
                                    fullUrl: `/storage/${dir}/${encodeURIComponent(file)}`  // URL completa para acceso directo
                                });
                            }
                        });
                        
                        if (attachments.length > 0) {
                            // Usar el nombre del primer archivo como título base
                            const mainAttachment = attachments.find(a => a.isPDF) || attachments[0];
                            const title = this.cleanFileName(mainAttachment.fileName);
                            
                            items.push({
                                id: dir,
                                title: title,
                                authors: 'Autor desconocido',
                                year: this.extractYearFromTitle(title),
                                dateAdded: stat.mtime.toISOString(),
                                type: 'document',
                                pdfPath: attachments.find(a => a.isPDF)?.path || null,
                                attachments: attachments,
                                hasAttachments: true,
                                source: 'file-system'
                            });
                        }
                    }
                } catch (err) {
                    // Ignorar carpetas inaccesibles
                    continue;
                }
            }
            
            // Ordenar por fecha de modificación más reciente
            items.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            
            console.log(`Encontrados ${items.length} items con attachments desde sistema de archivos`);
            return items;
            
        } catch (error) {
            console.error('Error leyendo archivos:', error);
            return [];
        }
    }
    
    extractYearFromTitle(title) {
        const match = title.match(/\b(19|20)\d{2}\b/);
        return match ? match[0] : 'Sin fecha';
    }
    
    async getLibraryStatistics() {
        try {
            const stats = {
                database: {
                    connected: this.db ? true : false,
                    path: ZOTERO_DB_PATH,
                    accessible: await fs.pathExists(ZOTERO_DB_PATH)
                },
                storage: {
                    path: path.join(ZOTERO_DATA_DIR, 'storage'),
                    exists: false,
                    totalFolders: 0,
                    totalFiles: 0,
                    pdfFiles: 0
                },
                biblioteca: {
                    path: ZOTERO_BIBLIOTECA_DIR,
                    exists: false,
                    totalFiles: 0,
                    pdfFiles: 0,
                    totalSize: 0
                },
                totals: {
                    allPdfs: 0,
                    allFiles: 0,
                    locations: 2
                },
                itemTypes: {},
                yearDistribution: {},
                lastUpdated: new Date().toISOString()
            };
            
            // Estadísticas de Storage
            const storageDir = path.join(ZOTERO_DATA_DIR, 'storage');
            if (await fs.pathExists(storageDir)) {
                stats.storage.exists = true;
                const folders = await fs.readdir(storageDir);
                stats.storage.totalFolders = folders.length;
                
                // Contar archivos en una muestra de carpetas
                let pdfCount = 0;
                let fileCount = 0;
                const sampleSize = Math.min(100, folders.length);
                
                for (let i = 0; i < sampleSize; i++) {
                    try {
                        const folderPath = path.join(storageDir, folders[i]);
                        const files = await fs.readdir(folderPath);
                        fileCount += files.length;
                        pdfCount += files.filter(f => f.toLowerCase().endsWith('.pdf')).length;
                    } catch (err) {
                        continue;
                    }
                }
                
                // Extrapolar basado en la muestra
                const multiplier = folders.length / sampleSize;
                stats.storage.totalFiles = Math.round(fileCount * multiplier);
                stats.storage.pdfFiles = Math.round(pdfCount * multiplier);
            }
            
            // Estadísticas de Biblioteca (directorio configurado por usuario)
            if (await fs.pathExists(ZOTERO_LIBRARY_DIR)) {
                stats.biblioteca.exists = true;
                const files = await fs.readdir(ZOTERO_LIBRARY_DIR);
                stats.biblioteca.totalFiles = files.length;
                stats.biblioteca.pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf')).length;
                
                // Calcular tamaño total (muestra)
                let totalSize = 0;
                const sampleFiles = files.slice(0, 50);
                
                for (const file of sampleFiles) {
                    try {
                        const filePath = path.join(ZOTERO_LIBRARY_DIR, file);
                        const fileStat = await fs.stat(filePath);
                        totalSize += fileStat.size;
                    } catch (err) {
                        continue;
                    }
                }
                
                stats.biblioteca.totalSize = Math.round((totalSize / sampleFiles.length) * files.length);
            }
            
            // Totales
            stats.totals.allPdfs = stats.storage.pdfFiles + stats.biblioteca.pdfFiles;
            stats.totals.allFiles = stats.storage.totalFiles + stats.biblioteca.totalFiles;
            
            // Estadísticas de base de datos (si disponible)
            if (this.db) {
                try {
                    // Contar tipos de elementos
                    const typeQuery = `
                        SELECT it.typeName, COUNT(*) as count 
                        FROM items i 
                        JOIN itemTypes it ON i.itemTypeID = it.itemTypeID 
                        WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
                        GROUP BY it.typeName 
                        ORDER BY count DESC
                    `;
                    
                    const types = await new Promise((resolve, reject) => {
                        this.db.all(typeQuery, (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows);
                        });
                    });
                    
                    types.forEach(type => {
                        stats.itemTypes[type.typeName] = type.count;
                    });
                    
                    // Distribución por años
                    const yearQuery = `
                        SELECT 
                            CASE 
                                WHEN iv_date.value LIKE '%2024%' THEN '2024'
                                WHEN iv_date.value LIKE '%2023%' THEN '2023'
                                WHEN iv_date.value LIKE '%2022%' THEN '2022'
                                WHEN iv_date.value LIKE '%2021%' THEN '2021'
                                WHEN iv_date.value LIKE '%2020%' THEN '2020'
                                WHEN iv_date.value LIKE '%201%' THEN '2010-2019'
                                WHEN iv_date.value LIKE '%200%' THEN '2000-2009'
                                ELSE 'Otros'
                            END as yearRange,
                            COUNT(*) as count
                        FROM items i
                        LEFT JOIN itemData id_date ON i.itemID = id_date.itemID AND id_date.fieldID = (
                            SELECT fieldID FROM fields WHERE fieldName = 'date'
                        )
                        LEFT JOIN itemDataValues iv_date ON id_date.valueID = iv_date.valueID
                        WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
                        GROUP BY yearRange
                        ORDER BY count DESC
                    `;
                    
                    const years = await new Promise((resolve, reject) => {
                        this.db.all(yearQuery, (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows);
                        });
                    });
                    
                    years.forEach(year => {
                        stats.yearDistribution[year.yearRange] = year.count;
                    });
                    
                } catch (dbError) {
                    console.log('No se pudieron obtener estadísticas de DB:', dbError.message);
                }
            }
            
            return stats;
            
        } catch (error) {
            console.error('Error calculando estadísticas:', error);
            throw error;
        }
    }
    
    cleanFileName(fileName) {
        return fileName
            .replace('.pdf', '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .trim();
    }
    
    extractYear(dateString) {
        if (!dateString) return 'Sin fecha';
        const match = dateString.match(/\b(19|20)\d{2}\b/);
        return match ? match[0] : 'Sin fecha';
    }
}

const zoteroAPI = new ZoteroAPI();

// Inicializar servicios adicionales
const pdfIndexingService = new PDFIndexingService(ZOTERO_LIBRARY_DIR);
const folderNavigationService = new FolderNavigationService(ZOTERO_LIBRARY_DIR);

// Inicializar sync manager
let syncManager;
setTimeout(() => {
    syncManager = new ZoteroSyncManager({ zoteroAPI });
}, 2000); // Esperar 2 segundos para que la API esté lista

// Rutas de la API mejoradas con cache
app.get('/library', async (req, res) => {
    try {
        // Usar cache si está disponible y es reciente
        if (syncManager && syncManager.cache.library && 
            (Date.now() - syncManager.cache.lastUpdate) < 30000) { // Cache válido por 30 segundos
            console.log('📋 Sirviendo desde cache');
            return res.json(syncManager.cache.library);
        }
        
        // Fallback a consulta directa
        const items = await zoteroAPI.getLibraryItems();
        res.json(items);
    } catch (error) {
        console.error('Error obteniendo biblioteca:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/library-stats', async (req, res) => {
    try {
        // Usar cache si está disponible
        if (syncManager && syncManager.cache.stats && 
            (Date.now() - syncManager.cache.lastUpdate) < 60000) { // Cache válido por 1 minuto
            console.log('📊 Sirviendo estadísticas desde cache');
            return res.json(syncManager.cache.stats);
        }
        
        // Fallback a consulta directa
        const stats = await zoteroAPI.getLibraryStatistics();
        res.json(stats);
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para forzar actualización
app.post('/sync/force-update', async (req, res) => {
    try {
        if (syncManager) {
            await syncManager.forceUpdate();
            res.json({ 
                message: 'Actualización forzada completada',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({ error: 'Sync manager no disponible' });
        }
    } catch (error) {
        console.error('Error en actualización forzada:', error);
        res.status(500).json({ error: 'Error forzando actualización' });
    }
});

// Rutas para navegación de carpetas
app.get('/folder-tree', async (req, res) => {
    try {
        const tree = await folderNavigationService.getFolderTree();
        res.json(tree);
    } catch (error) {
        console.error('Error obteniendo árbol de carpetas:', error);
        res.status(500).json({ error: 'Error accediendo al árbol de carpetas' });
    }
});

app.get('/folder-contents/:path(*)', async (req, res) => {
    try {
        const folderPath = req.params.path || '';
        const contents = await folderNavigationService.getFolderContents(folderPath);
        res.json(contents);
    } catch (error) {
        console.error('Error obteniendo contenidos de carpeta:', error);
        res.status(500).json({ error: 'Error accediendo a la carpeta' });
    }
});

app.get('/search-folders/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const results = await folderNavigationService.searchInFolders(query);
        res.json(results);
    } catch (error) {
        console.error('Error buscando en carpetas:', error);
        res.status(500).json({ error: 'Error en búsqueda' });
    }
});

// Rutas para indexación y búsqueda de texto
app.get('/search-text/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const results = await pdfIndexingService.searchText(query);
        res.json(results);
    } catch (error) {
        console.error('Error buscando texto:', error);
        res.status(500).json({ error: 'Error en búsqueda de texto' });
    }
});

app.get('/indexing-status', (req, res) => {
    const status = pdfIndexingService.getStatus();
    const folderStats = folderNavigationService.getStatistics();
    
    res.json({
        indexing: status,
        folders: folderStats
    });
});

app.post('/scan-pdfs', async (req, res) => {
    try {
        pdfIndexingService.scanForNewPDFs();
        res.json({ message: 'Escaneo de PDFs iniciado en segundo plano' });
    } catch (error) {
        console.error('Error iniciando escaneo:', error);
        res.status(500).json({ error: 'Error iniciando escaneo' });
    }
});

app.get('/item/:id', async (req, res) => {
    try {
        const items = await zoteroAPI.getLibraryItems();
        const item = items.find(i => i.id.toString() === req.params.id);
        
        if (!item) {
            return res.status(404).json({ error: 'Elemento no encontrado' });
        }
        
        res.json(item);
    } catch (error) {
        console.error('Error obteniendo elemento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: zoteroAPI.db ? 'connected' : 'file-mode'
    });
});

// Ruta para obtener estadísticas completas de la biblioteca
app.get('/library-stats', async (req, res) => {
    try {
        const stats = await zoteroAPI.getLibraryStatistics();
        res.json(stats);
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error calculando estadísticas' });
    }
});

// Ruta para explorar estructura de storage
app.get('/storage-info', async (req, res) => {
    try {
        const storageDir = path.join(ZOTERO_DATA_DIR, 'storage');
        const stats = await fs.stat(storageDir);
        
        const folders = await fs.readdir(storageDir);
        const folderStats = await Promise.all(
            folders.slice(0, 20).map(async (folder) => {
                try {
                    const folderPath = path.join(storageDir, folder);
                    const files = await fs.readdir(folderPath);
                    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
                    
                    return {
                        folder,
                        totalFiles: files.length,
                        pdfFiles: pdfFiles.length,
                        files: pdfFiles.slice(0, 3) // Primeros 3 PDFs como ejemplo
                    };
                } catch (err) {
                    return { folder, error: 'No accesible' };
                }
            })
        );
        
        res.json({
            storageDir,
            totalFolders: folders.length,
            sampleFolders: folderStats
        });
    } catch (error) {
        console.error('Error obteniendo info de storage:', error);
        res.status(500).json({ error: 'Error accediendo al storage' });
    }
});

// Ruta para explorar la biblioteca de documentos (configurada por usuario)
app.get('/library-info', async (req, res) => {
    try {
        if (!await fs.pathExists(ZOTERO_LIBRARY_DIR)) {
            return res.status(404).json({ error: 'Directorio de biblioteca no encontrado' });
        }
        
        const files = await fs.readdir(ZOTERO_LIBRARY_DIR);
        const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
        const otherFiles = files.filter(f => !f.toLowerCase().endsWith('.pdf'));
        
        const samplePdfs = await Promise.all(
            pdfFiles.slice(0, 20).map(async (file) => {
                const filePath = path.join(ZOTERO_LIBRARY_DIR, file);
                const stats = await fs.stat(filePath);
                
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                    downloadUrl: `/library/${encodeURIComponent(file)}`
                };
            })
        );
        
        res.json({
            libraryDir: ZOTERO_LIBRARY_DIR,
            totalFiles: files.length,
            totalPdfs: pdfFiles.length,
            otherFiles: otherFiles.length,
            samplePdfs
        });
    } catch (error) {
        console.error('Error obteniendo info de biblioteca:', error);
        res.status(500).json({ error: 'Error accediendo a la biblioteca' });
    }
});

// Ruta para listar archivos de una carpeta específica
app.get('/storage-folder/:folderId', async (req, res) => {
    try {
        const folderId = req.params.folderId;
        const folderPath = path.join(ZOTERO_DATA_DIR, 'storage', folderId);
        
        // Verificar que la carpeta existe y está dentro del storage
        if (!await fs.pathExists(folderPath)) {
            return res.status(404).json({ error: 'Carpeta no encontrada' });
        }
        
        const files = await fs.readdir(folderPath);
        const fileDetails = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(folderPath, file);
                const stats = await fs.stat(filePath);
                
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                    isPDF: file.toLowerCase().endsWith('.pdf'),
                    downloadUrl: `/storage/${folderId}/${file}`
                };
            })
        );
        
        res.json({
            folderId,
            files: fileDetails
        });
    } catch (error) {
        console.error('Error listando carpeta:', error);
        res.status(500).json({ error: 'Error accediendo a la carpeta' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Zotero API ejecutándose en puerto ${PORT}`);
    console.log(`📚 Directorio de datos: ${ZOTERO_DATA_DIR}`);
    console.log(`📁 Directorio de biblioteca: ${ZOTERO_LIBRARY_DIR}`);
    console.log(`🔄 Sincronización en tiempo real: ACTIVADA`);
    console.log(`📡 WebSocket para notificaciones: Puerto 3002`);
});