const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8080;

// Configuración de directorios
const WEB_DIR = path.join(__dirname, 'web');
const STORAGE_DIR = '/home/arkantu/Zotero/storage';
const BIBLIOTECA_DIR = '/home/arkantu/Documentos/Zotero Biblioteca';

console.log('🌐 Iniciando servidor híbrido Zotero...');
console.log('📁 Storage:', STORAGE_DIR);
console.log('📚 Biblioteca:', BIBLIOTECA_DIR);
console.log('🌐 Web:', WEB_DIR);

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Proxy para API
const apiProxy = createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    pathRewrite: {
        '^/api': '',
    },
    onError: (err, req, res) => {
        console.error('Error en proxy API:', err.message);
        res.status(500).send('Error de proxy API');
    },
    logLevel: 'silent'
});

app.use('/api', apiProxy);

// Servir archivos de storage
app.use('/storage', express.static(STORAGE_DIR, {
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.pdf') {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline');
            res.set('Cache-Control', 'public, max-age=31536000');
            console.log(`📄 Sirviendo PDF: ${path.basename(filePath)}`);
        } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(ext)) {
            res.set('Cache-Control', 'public, max-age=31536000');
            console.log(`🖼️  Sirviendo imagen: ${path.basename(filePath)}`);
        }
        
        res.set('Access-Control-Allow-Origin', '*');
    },
    fallthrough: true
}));

// Servir archivos de biblioteca
app.use('/biblioteca', express.static(BIBLIOTECA_DIR, {
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.pdf') {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline');
            res.set('Cache-Control', 'public, max-age=31536000');
            console.log(`📚 Sirviendo biblioteca PDF: ${path.basename(filePath)}`);
        }
        
        res.set('Access-Control-Allow-Origin', '*');
    },
    fallthrough: true
}));

// Servir archivos estáticos del frontend
app.use(express.static(WEB_DIR));

// Manejo de errores 404 para archivos
app.use('/storage', (req, res) => {
    console.log(`❌ Storage 404: ${req.url}`);
    res.status(404).send('Archivo no encontrado en storage');
});

app.use('/biblioteca', (req, res) => {
    console.log(`❌ Biblioteca 404: ${req.url}`);
    res.status(404).send('Archivo no encontrado en biblioteca');
});

// SPA fallback para rutas web
app.get('*', (req, res) => {
    const indexPath = path.join(WEB_DIR, 'index.html');
    res.sendFile(indexPath);
});

// Manejo general de errores
app.use((err, req, res, next) => {
    console.error('Error del servidor:', err);
    res.status(500).send('Error interno del servidor');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor híbrido funcionando en puerto ${PORT}`);
    console.log(`📍 Acceso local: http://localhost:${PORT}`);
    console.log(`🌍 Acceso red: http://0.0.0.0:${PORT}`);
    console.log(`🔧 Proxy API: /api -> http://localhost:3000`);
    console.log(`📁 Ruta storage: /storage -> ${STORAGE_DIR}`);
    console.log(`📚 Ruta biblioteca: /biblioteca -> ${BIBLIOTECA_DIR}`);
});