const express = require('express');
const path = require('path');
const app = express();
const PORT = 8080;

// Configuración de directorios
const WEB_DIR = path.join(__dirname, 'web');
const STORAGE_DIR = '/home/arkantu/Zotero/storage';
const BIBLIOTECA_DIR = '/home/arkantu/Documentos/Zotero Biblioteca';

console.log('🌐 Iniciando servidor híbrido completo...');

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Proxy para API
app.use('/api', (req, res) => {
    const apiUrl = `http://localhost:3000${req.url}`;
    console.log(`📡 Proxy API: ${req.method} ${apiUrl}`);
    
    const http = require('http');
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: req.url,
        method: req.method,
        headers: req.headers
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
        console.error('Error en proxy API:', err);
        res.status(500).send('Error de proxy');
    });
    
    if (req.body) {
        proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
});

// Servir archivos de storage con configuración especial
app.use('/storage', express.static(STORAGE_DIR, {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.pdf') {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline');
            res.set('Cache-Control', 'public, max-age=31536000');
        } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(ext)) {
            res.set('Cache-Control', 'public, max-age=31536000');
        }
        
        res.set('Access-Control-Allow-Origin', '*');
        console.log(`📄 Sirviendo: ${filePath}`);
    }
}));

// Servir archivos de biblioteca
app.use('/biblioteca', express.static(BIBLIOTECA_DIR, {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.pdf') {
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', 'inline');
            res.set('Cache-Control', 'public, max-age=31536000');
        }
        
        res.set('Access-Control-Allow-Origin', '*');
        console.log(`📚 Sirviendo biblioteca: ${filePath}`);
    }
}));

// Middleware para logging
app.use((req, res, next) => {
    if (req.url.startsWith('/storage') || req.url.startsWith('/biblioteca')) {
        console.log(`🔍 Solicitud archivo: ${req.method} ${req.url}`);
    }
    next();
});

// Servir archivos estáticos del frontend
app.use(express.static(WEB_DIR));

// SPA fallback - servir index.html para rutas no encontradas
app.get('*', (req, res) => {
    res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error del servidor:', err);
    res.status(500).send('Error interno del servidor');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor híbrido funcionando en puerto ${PORT}`);
    console.log(`📍 Acceso local: http://localhost:${PORT}`);
    console.log(`🌍 Acceso red: http://0.0.0.0:${PORT}`);
    console.log(`📁 Storage: ${STORAGE_DIR}`);
    console.log(`📚 Biblioteca: ${BIBLIOTECA_DIR}`);
    console.log(`🔧 Proxy API: /api -> http://localhost:3000`);
});