const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8080;

console.log('🌐 Iniciando servidor híbrido Zotero...');

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Proxy para API - DEBE ir antes de los archivos estáticos
const apiProxy = createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    pathRewrite: {
        '^/api': '', // Remueve /api del path
    },
    logLevel: 'debug'
});

app.use('/api', apiProxy);

// Servir archivos estáticos desde la carpeta web
app.use(express.static(path.join(__dirname, 'web')));

// SPA fallback - servir index.html para rutas no encontradas
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor híbrido funcionando en puerto ${PORT}`);
    console.log(`📍 Acceso local: http://localhost:${PORT}`);
    console.log(`🌍 Acceso red: http://0.0.0.0:${PORT}`);
    console.log(`🔧 Proxy API: /api -> http://localhost:3000`);
});