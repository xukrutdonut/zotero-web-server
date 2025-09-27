const fs = require('fs-extra');
const path = require('path');

class FolderNavigationService {
    constructor(libraryDir) {
        this.libraryDir = libraryDir;
        this.cache = null;
        this.lastUpdate = 0;
        this.cacheTimeout = 300000; // 5 minutos
    }
    
    async getFolderTree() {
        // Usar cache si es válido
        if (this.cache && (Date.now() - this.lastUpdate) < this.cacheTimeout) {
            return this.cache;
        }
        
        try {
            console.log('🌳 Generando árbol de carpetas...');
            this.cache = await this.buildFolderTree(this.libraryDir);
            this.lastUpdate = Date.now();
            return this.cache;
        } catch (error) {
            console.error('Error generando árbol de carpetas:', error);
            return { name: 'Error', children: [], files: [] };
        }
    }
    
    async buildFolderTree(dirPath, relativePath = '') {
        const name = path.basename(dirPath) || 'Zotero Biblioteca';
        const tree = {
            name: name,
            path: relativePath,
            children: [],
            files: [],
            totalFiles: 0,
            totalPdfs: 0
        };
        
        try {
            const items = await fs.readdir(dirPath);
            const folders = [];
            const files = [];
            
            // Separar carpetas y archivos
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory()) {
                    folders.push(item);
                } else {
                    files.push({
                        name: item,
                        path: path.join(relativePath, item),
                        size: stats.size,
                        modified: stats.mtime,
                        isPdf: item.toLowerCase().endsWith('.pdf')
                    });
                }
            }
            
            // Procesar archivos
            tree.files = files.sort((a, b) => a.name.localeCompare(b.name));
            tree.totalFiles = files.length;
            tree.totalPdfs = files.filter(f => f.isPdf).length;
            
            // Procesar subcarpetas recursivamente
            for (const folder of folders.sort()) {
                const subPath = path.join(dirPath, folder);
                const subRelativePath = path.join(relativePath, folder);
                const subTree = await this.buildFolderTree(subPath, subRelativePath);
                
                tree.children.push(subTree);
                tree.totalFiles += subTree.totalFiles;
                tree.totalPdfs += subTree.totalPdfs;
            }
            
        } catch (error) {
            console.error(`Error accediendo a ${dirPath}:`, error.message);
        }
        
        return tree;
    }
    
    async searchInFolders(query) {
        const tree = await this.getFolderTree();
        const results = [];
        
        const searchRecursive = (node, currentPath = '') => {
            // Buscar en archivos
            node.files.forEach(file => {
                if (file.name.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        type: 'file',
                        name: file.name,
                        path: file.path,
                        folder: currentPath || 'Raíz',
                        isPdf: file.isPdf,
                        size: file.size,
                        modified: file.modified
                    });
                }
            });
            
            // Buscar en subcarpetas
            node.children.forEach(child => {
                if (child.name.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        type: 'folder',
                        name: child.name,
                        path: child.path,
                        folder: currentPath || 'Raíz',
                        totalFiles: child.totalFiles,
                        totalPdfs: child.totalPdfs
                    });
                }
                
                // Buscar recursivamente
                const childPath = currentPath ? `${currentPath}/${child.name}` : child.name;
                searchRecursive(child, childPath);
            });
        };
        
        searchRecursive(tree);
        return results.slice(0, 50); // Limitar resultados
    }
    
    async getFolderContents(folderPath) {
        const fullPath = path.join(this.libraryDir, folderPath);
        
        try {
            const items = await fs.readdir(fullPath);
            const contents = {
                path: folderPath,
                files: [],
                folders: []
            };
            
            for (const item of items) {
                const itemPath = path.join(fullPath, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory()) {
                    contents.folders.push({
                        name: item,
                        path: path.join(folderPath, item)
                    });
                } else {
                    contents.files.push({
                        name: item,
                        path: path.join(folderPath, item),
                        size: stats.size,
                        modified: stats.mtime,
                        isPdf: item.toLowerCase().endsWith('.pdf'),
                        downloadUrl: `/library/${encodeURIComponent(path.join(folderPath, item))}`
                    });
                }
            }
            
            contents.folders.sort((a, b) => a.name.localeCompare(b.name));
            contents.files.sort((a, b) => a.name.localeCompare(b.name));
            
            return contents;
        } catch (error) {
            throw new Error(`Error accediendo a la carpeta: ${error.message}`);
        }
    }
    
    getStatistics() {
        if (!this.cache) {
            return null;
        }
        
        const countFolders = (node) => {
            let count = node.children.length;
            node.children.forEach(child => {
                count += countFolders(child);
            });
            return count;
        };
        
        return {
            totalFolders: countFolders(this.cache),
            totalFiles: this.cache.totalFiles,
            totalPdfs: this.cache.totalPdfs,
            lastUpdate: new Date(this.lastUpdate).toISOString()
        };
    }
}

module.exports = FolderNavigationService;