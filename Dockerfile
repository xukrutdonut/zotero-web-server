# Dockerfile para Servidor Zotero Web - NeuropediaLab 2025
FROM node:18-alpine

# Información del contenedor
LABEL maintainer="NeuropediaLab"
LABEL description="Servidor web para acceso y búsqueda en biblioteca Zotero con indexación de texto completo"
LABEL version="2.0"

# Instalar dependencias del sistema
RUN apk add --no-cache \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-spa \
    tesseract-ocr-data-eng \
    curl \
    && rm -rf /var/cache/apk/*

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S zotero -u 1001 -G nodejs

# Crear directorios de trabajo
WORKDIR /app

# Copiar archivos de configuración primero (para cache de Docker)
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p logs web data && \
    chown -R zotero:nodejs /app

# Cambiar al usuario no-root
USER zotero

# Exponer puerto
EXPOSE 8080

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=8080
ENV BIBLIOTECA_DIR=/app/data/biblioteca
ENV ZOTERO_DB=/app/data/zotero.sqlite

# Comando de health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/stats || exit 1

# Comando de inicio
CMD ["node", "final-clean-server.js"]