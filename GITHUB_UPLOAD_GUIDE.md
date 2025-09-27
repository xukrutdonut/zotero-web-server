# 🚀 Cómo subir Zotero Web Server a GitHub

## Pasos Previos

### 1. Crear Repositorio en GitHub
1. Ve a [GitHub](https://github.com) e inicia sesión
2. Haz clic en el botón **"+"** en la esquina superior derecha
3. Selecciona **"New repository"**
4. Configura el repositorio:
   - **Repository name**: `zotero-web-server` (o el nombre que prefieras)
   - **Description**: `Servidor web para acceder a biblioteca Zotero con interfaz moderna`
   - **Visibility**: Público o Privado (según prefieras)
   - ❌ **NO marques** "Initialize with README" (ya tenemos archivos locales)
   - ❌ **NO agregues** .gitignore ni license (ya los tenemos)
5. Haz clic en **"Create repository"**

### 2. Configurar Git (si no está configurado)
```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu.email@gmail.com"
```

## Opción A: Usando el Script Automático

Ejecuta el script que creé para ti:
```bash
./upload-to-github.sh
```

El script te guiará paso a paso y te pedirá:
- La URL de tu repositorio GitHub
- Confirmación antes de subir

## Opción B: Manual

### 1. Agregar el Repositorio Remoto
```bash
# Reemplaza con tu URL de repositorio
git remote add origin https://github.com/tu-usuario/zotero-web-server.git
```

### 2. Verificar que Todo Esté Listo
```bash
git status
git log --oneline -3
```

### 3. Subir a GitHub
```bash
git push -u origin main
```

## Después de Subir

Una vez subido, tu repositorio estará disponible en:
- **URL Principal**: `https://github.com/tu-usuario/zotero-web-server`
- **Clonar**: `git clone https://github.com/tu-usuario/zotero-web-server.git`

## Estructura del Repositorio Subido

```
zotero-web-server/
├── 📄 README.md              # Documentación principal
├── 🐳 Dockerfile            # Imagen Docker
├── 🐳 docker-compose.yml    # Configuración Docker Compose
├── ⚙️  package.json          # Dependencias Node.js
├── 🚀 enhanced-server-no-watchers.js  # Servidor principal
├── 📁 web/                  # Interfaz web
│   ├── index.html
│   ├── debug.html
│   └── test-api.html
├── 📁 api/                  # Endpoints de la API
├── 🔧 .env.example          # Variables de entorno ejemplo
├── 🔧 start-simple.sh       # Script de inicio simple
├── 🔧 stop-simple.sh        # Script de parada simple
├── 🐳 start-docker.sh       # Script Docker completo
├── 🐳 stop-docker.sh        # Script parada Docker
└── 📄 LICENSE               # Licencia MIT
```

## Comandos Útiles Post-Subida

### Clonar en Otro Lugar
```bash
git clone https://github.com/tu-usuario/zotero-web-server.git
cd zotero-web-server
```

### Actualizar Cambios Futuros
```bash
git add .
git commit -m "Descripción de cambios"
git push origin main
```

### Ver Estado del Repositorio
```bash
git remote -v
git status
git log --oneline -5
```

## Características del Proyecto Subido

✅ **Servidor Web Moderno**: Node.js con Express
✅ **Interfaz Responsive**: HTML5 con Bootstrap
✅ **API RESTful**: Endpoints para acceder a Zotero
✅ **Docker Ready**: Containerización completa
✅ **Documentación**: README completo
✅ **Licencia MIT**: Código abierto
✅ **Scripts Automatizados**: Inicio/parada simplificados

## Solución de Problemas

### Error: "Repository does not exist"
- Verifica que hayas creado el repositorio en GitHub
- Verifica que la URL sea correcta

### Error: "Permission denied"
- Configura autenticación SSH o token personal
- O usa HTTPS con tu usuario/contraseña

### Error: "Branch main doesn't exist"
- Cambia a la rama main: `git checkout -b main`
- O usa: `git push -u origin HEAD:main`

---

🎉 **¡Tu Zotero Web Server estará disponible en GitHub para que otros puedan usarlo y contribuir!**