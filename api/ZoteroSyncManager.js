const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');

class ZoteroSyncManager {
    constructor(apiServer) {
        this.apiServer = apiServer;
        this.zoteroDataDir = process.env.ZOTERO_DATA_DIR || '/home/arkantu/Zotero';
        this.zoteroLibraryDir = process.env.ZOTERO_LIBRARY_DIR || '/home/arkantu/Documentos/Zotero Biblioteca';
        this.dbPath = path.join(this.zoteroDataDir, 'zotero.sqlite');
        
        this.lastDbChange = 0;
        this.cache = {
            library: null,
            stats: null,
            lastUpdate: 0
        };
        
        this.wsServer = null;
        this.clients = new Set();
        
        console.log('🔄 Inicializando ZoteroSyncManager...');
        this.init();
    }
    
    async init() {
        try {
            // Configurar WebSocket para notificaciones en tiempo real
            this.setupWebSocket();
            
            // Intentar configurar watchers, si falla usar modo polling
            try {
                this.setupFileWatchers();
            } catch (watcherError) {
                console.warn('⚠️  Error configurando watchers, usando modo polling:', watcherError.message);
                this.setupPollingMode();
            }
            
            // Cache inicial
            await this.updateCache();
            
            console.log('✅ ZoteroSyncManager inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando sync manager:', error);
            // Continuar sin sync si hay errores
            console.log('🔄 Continuando sin sincronización automática');
        }
    }
    
    setupPollingMode() {
        console.log('🔄 Iniciando modo polling (sin watchers)...');
        
        // Polling de la base de datos cada 30 segundos
        this.dbPollingInterval = setInterval(async () => {
            try {
                const stats = await fs.stat(this.dbPath);
                if (stats.mtime.getTime() > this.lastDbChange + 5000) {
                    this.lastDbChange = stats.mtime.getTime();
                    console.log('📝 Cambio detectado en base de datos (polling)');
                    this.handleDatabaseChange();
                }
            } catch (error) {
                // Ignorar errores de polling
            }
        }, 30000);
        
        console.log('⏰ Polling configurado cada 30 segundos');
    }
    
    setupWebSocket() {
        this.wsServer = new WebSocket.Server({ port: 3002 });
        
        this.wsServer.on('connection', (ws) => {
            this.clients.add(ws);
            console.log(`📡 Cliente conectado. Total: ${this.clients.size}`);
            
            // Enviar datos iniciales
            ws.send(JSON.stringify({
                type: 'initial',
                data: {
                    library: this.cache.library,
                    stats: this.cache.stats,
                    timestamp: new Date().toISOString()
                }
            }));
            
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`📡 Cliente desconectado. Total: ${this.clients.size}`);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
        
        console.log('📡 WebSocket server iniciado en puerto 3002');
    }
    
    setupFileWatchers() {
        // Watcher para la base de datos SQLite (más conservador)
        const dbWatcher = chokidar.watch(this.dbPath, {
            persistent: true,
            ignoreInitial: true,
            usePolling: true,
            interval: 2000,  // Polling cada 2 segundos
            binaryInterval: 3000
        });
        
        dbWatcher.on('change', () => {
            const now = Date.now();
            if (now - this.lastDbChange > 5000) { // Debounce de 5 segundos
                this.lastDbChange = now;
                console.log('📝 Cambio detectado en base de datos Zotero');
                this.handleDatabaseChange();
            }
        });
        
        // Watcher solo para el directorio raíz de biblioteca (no recursivo)
        const libraryWatcher = chokidar.watch(this.zoteroLibraryDir, {
            persistent: true,
            ignoreInitial: true,
            depth: 0,  // Solo nivel raíz
            usePolling: true,
            interval: 5000
        });
        
        libraryWatcher.on('add', (filePath) => {
            if (filePath.toLowerCase().endsWith('.pdf')) {
                console.log('📄 Nuevo PDF agregado:', path.basename(filePath));
                this.handleFileChange('add', filePath);
            }
        });
        
        libraryWatcher.on('unlink', (filePath) => {
            if (filePath.toLowerCase().endsWith('.pdf')) {
                console.log('🗑️  PDF eliminado:', path.basename(filePath));
                this.handleFileChange('remove', filePath);
            }
        });
        
        console.log('👀 Watchers configurados (modo conservador):');
        console.log(`   📝 Base de datos: ${this.dbPath} (polling)`);
        console.log(`   📚 Biblioteca: ${this.zoteroLibraryDir} (nivel raíz)`);
        console.log(`   ⚡ Optimizado para evitar límites de inotify`);
    }
    
    async handleDatabaseChange() {
        try {
            // Esperar un poco para evitar leer DB mientras está siendo escrita
            setTimeout(async () => {
                await this.updateCache();
                this.notifyClients({
                    type: 'database_update',
                    message: 'Base de datos actualizada',
                    data: {
                        library: this.cache.library,
                        stats: this.cache.stats
                    }
                });
            }, 1000);
        } catch (error) {
            console.error('Error manejando cambio de base de datos:', error);
        }
    }
    
    async handleFileChange(action, filePath) {
        try {
            // Actualizar estadísticas
            await this.updateStats();
            
            // Notificar cambio de archivo
            this.notifyClients({
                type: 'file_change',
                action: action,
                file: path.basename(filePath),
                message: `Archivo ${action === 'add' ? 'agregado' : 'eliminado'}: ${path.basename(filePath)}`,
                stats: this.cache.stats
            });
        } catch (error) {
            console.error('Error manejando cambio de archivo:', error);
        }
    }
    
    async updateCache() {
        try {
            console.log('🔄 Actualizando cache...');
            
            // Actualizar datos de biblioteca
            if (this.apiServer.zoteroAPI) {
                this.cache.library = await this.apiServer.zoteroAPI.getLibraryItems();
                this.cache.stats = await this.apiServer.zoteroAPI.getLibraryStatistics();
            }
            
            this.cache.lastUpdate = Date.now();
            console.log(`✅ Cache actualizado: ${this.cache.library?.length || 0} items`);
        } catch (error) {
            console.error('Error actualizando cache:', error);
        }
    }
    
    async updateStats() {
        try {
            if (this.apiServer.zoteroAPI) {
                this.cache.stats = await this.apiServer.zoteroAPI.getLibraryStatistics();
            }
        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
    }
    
    notifyClients(message) {
        const data = JSON.stringify({
            ...message,
            timestamp: new Date().toISOString()
        });
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
        
        console.log(`📡 Notificación enviada a ${this.clients.size} clientes: ${message.message}`);
    }
    
    getCache() {
        return this.cache;
    }
    
    async forceUpdate() {
        console.log('🔄 Forzando actualización completa...');
        await this.updateCache();
        this.notifyClients({
            type: 'force_update',
            message: 'Actualización forzada completada',
            data: {
                library: this.cache.library,
                stats: this.cache.stats
            }
        });
    }
}

module.exports = ZoteroSyncManager;