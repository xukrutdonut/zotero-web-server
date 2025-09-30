const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class PDFIndexingService {
    constructor(libraryDir) {
        this.libraryDir = libraryDir;
        this.indexDir = path.join(process.cwd(), 'pdf_index');
        this.isIndexing = false;
        this.indexQueue = [];
        this.maxConcurrent = 1; // Procesar solo 1 PDF a la vez para no sobrecargar
        this.currentlyProcessing = 0;
        
        this.init();
    }
    
    async init() {
        // Crear directorio de índice
        await fs.ensureDir(this.indexDir);
        
        // Programar indexación cada 30 minutos durante horas de baja actividad
        cron.schedule('*/30 * * * *', () => {
            this.processQueue();
        });
        
        // Hacer scan inicial después de 10 segundos
        setTimeout(() => {
            this.scanForNewPDFs();
        }, 10000);
        
        console.log('📖 Servicio de indexación PDF inicializado');
        console.log(`📁 Directorio de índices: ${this.indexDir}`);
        console.log('⏰ Programado cada 30 minutos');
    }
    
    async scanForNewPDFs() {
        if (this.isIndexing) {
            console.log('📖 Indexación ya en progreso, saltando...');
            return;
        }
        
        try {
            this.isIndexing = true;
            console.log('🔍 Escaneando PDFs para indexar...');
            
            const pdfs = await this.getAllPDFs();
            const newPdfs = [];
            
            // Verificar cuáles PDFs no están indexados
            for (const pdf of pdfs) {
                const indexFile = this.getIndexFilePath(pdf);
                if (!await fs.pathExists(indexFile)) {
                    newPdfs.push(pdf);
                }
            }
            
            console.log(`📄 Encontrados ${newPdfs.length} PDFs nuevos para indexar`);
            
            // Agregar a la cola
            this.indexQueue = [...this.indexQueue, ...newPdfs];
            
            // Procesar cola inmediatamente si hay espacio
            this.processQueue();
            
        } catch (error) {
            console.error('Error escaneando PDFs:', error);
        } finally {
            this.isIndexing = false;
        }
    }
    
    async getAllPDFs() {
        const pdfs = [];
        
        async function scanDir(dir) {
            try {
                const items = await fs.readdir(dir);
                
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stats = await fs.stat(fullPath);
                    
                    if (stats.isDirectory()) {
                        await scanDir(fullPath);
                    } else if (item.toLowerCase().endsWith('.pdf')) {
                        pdfs.push(fullPath);
                    }
                }
            } catch (error) {
                // Ignorar errores de acceso
            }
        }
        
        await scanDir(this.libraryDir);
        return pdfs;
    }
    
    async processQueue() {
        if (this.currentlyProcessing >= this.maxConcurrent || this.indexQueue.length === 0) {
            return;
        }
        
        const pdf = this.indexQueue.shift();
        this.currentlyProcessing++;
        
        console.log(`📖 Procesando PDF: ${path.basename(pdf)} (Cola: ${this.indexQueue.length})`);
        
        try {
            await this.indexPDF(pdf);
            console.log(`✅ Indexado: ${path.basename(pdf)}`);
        } catch (error) {
            console.error(`❌ Error indexando ${path.basename(pdf)}:`, error.message);
        } finally {
            this.currentlyProcessing--;
            
            // Procesar siguiente con delay para no saturar
            if (this.indexQueue.length > 0) {
                setTimeout(() => this.processQueue(), 2000);
            }
        }
    }
    
    async indexPDF(pdfPath) {
        const indexFile = this.getIndexFilePath(pdfPath);
        
        try {
            // Paso 1: Intentar extraer texto directamente
            let text = await this.extractTextWithPdftotext(pdfPath);
            
            // Paso 2: Si no hay texto o es muy poco, usar OCR
            if (!text || text.trim().length < 50) {
                console.log(`🔍 Aplicando OCR a ${path.basename(pdfPath)}`);
                text = await this.extractTextWithOCR(pdfPath);
            }
            
            // Paso 3: Guardar índice
            const indexData = {
                pdfPath: pdfPath,
                fileName: path.basename(pdfPath),
                relativePath: path.relative(this.libraryDir, pdfPath),
                text: text.substring(0, 50000), // Limitar a 50KB de texto
                wordCount: text.split(/\s+/).length,
                indexed: new Date().toISOString(),
                method: text.trim().length >= 50 ? 'direct' : 'ocr'
            };
            
            await fs.writeJson(indexFile, indexData, { spaces: 2 });
            
        } catch (error) {
            // Si falla completamente, guardar índice mínimo
            const errorIndex = {
                pdfPath: pdfPath,
                fileName: path.basename(pdfPath),
                relativePath: path.relative(this.libraryDir, pdfPath),
                text: '',
                error: error.message,
                indexed: new Date().toISOString(),
                method: 'failed'
            };
            
            await fs.writeJson(indexFile, errorIndex, { spaces: 2 });
            throw error;
        }
    }
    
    async extractTextWithPdftotext(pdfPath) {
        try {
            // Usar pdftotext con límites de tiempo y recursos
            const command = `timeout 30s pdftotext -layout "${pdfPath}" -`;
            const { stdout } = await execAsync(command, {
                maxBuffer: 1024 * 1024 * 2, // 2MB max
                timeout: 35000 // 35 segundos timeout
            });
            
            return stdout.trim();
        } catch (error) {
            console.log(`⚠️  pdftotext falló para ${path.basename(pdfPath)}`);
            return '';
        }
    }
    
    async extractTextWithOCR(pdfPath) {
        try {
            // Convertir primera página a imagen y aplicar OCR
            const tempDir = path.join(this.indexDir, 'temp');
            await fs.ensureDir(tempDir);
            
            const imageFile = path.join(tempDir, `${path.basename(pdfPath)}.png`);
            
            // Convertir primera página del PDF a imagen (con límites de recursos)
            const convertCommand = `timeout 60s pdftoppm -f 1 -l 1 -png -r 150 "${pdfPath}" "${imageFile.replace('.png', '')}"`;
            await execAsync(convertCommand, { timeout: 65000 });
            
            // Aplicar OCR con Tesseract
            const ocrCommand = `timeout 60s tesseract "${imageFile}" stdout -l spa+eng`;
            const { stdout } = await execAsync(ocrCommand, { 
                timeout: 65000,
                maxBuffer: 1024 * 512 // 512KB max
            });
            
            // Limpiar archivo temporal
            await fs.remove(imageFile);
            
            return stdout.trim();
        } catch (error) {
            console.log(`⚠️  OCR falló para ${path.basename(pdfPath)}`);
            return '';
        }
    }
    
    getIndexFilePath(pdfPath) {
        const relativePath = path.relative(this.libraryDir, pdfPath);
        const indexFileName = relativePath.replace(/[/\\]/g, '_').replace('.pdf', '.json');
        return path.join(this.indexDir, indexFileName);
    }
    
    async searchText(query) {
        try {
            const indexFiles = await fs.readdir(this.indexDir);
            const results = [];
            
            const queryLower = query.toLowerCase();
            
            for (const indexFile of indexFiles) {
                if (!indexFile.endsWith('.json')) continue;
                
                try {
                    const indexData = await fs.readJson(path.join(this.indexDir, indexFile));
                    
                    if (indexData.text && indexData.text.toLowerCase().includes(queryLower)) {
                        // Encontrar contexto alrededor de la coincidencia
                        const textLower = indexData.text.toLowerCase();
                        const matchIndex = textLower.indexOf(queryLower);
                        const start = Math.max(0, matchIndex - 100);
                        const end = Math.min(indexData.text.length, matchIndex + query.length + 100);
                        const context = indexData.text.substring(start, end);
                        
                        results.push({
                            file: indexData.fileName,
                            path: indexData.pdfPath || indexData.relativePath,
                            context: context,
                            method: indexData.method,
                            wordCount: indexData.wordCount,
                            indexed: indexData.indexed
                        });
                    }
                } catch (error) {
                    // Ignorar archivos de índice corruptos
                    continue;
                }
            }
            
            return results.slice(0, 20); // Limitar a 20 resultados
        } catch (error) {
            console.error('Error en búsqueda de texto:', error);
            return [];
        }
    }
    
    getStatus() {
        return {
            indexing: this.isIndexing,
            queueLength: this.indexQueue.length,
            processing: this.currentlyProcessing,
            indexDir: this.indexDir
        };
    }
}

module.exports = PDFIndexingService;