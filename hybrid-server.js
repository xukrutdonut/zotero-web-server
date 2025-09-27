const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8080;

// Servir archivos estáticos
app.use(express.static('web'));

// Proxy para API
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    pathRewrite: {
        '^/api': '', // Remueve /api del path
    },
}));

// Servir index.html para cualquier ruta no encontrada (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor híbrido funcionando en puerto ${PORT}`);
    console.log(`📍 Acceso local: http://localhost:${PORT}`);
    console.log(`🌍 Acceso red: http://0.0.0.0:${PORT}`);
});
