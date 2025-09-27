# 🌐 Configuración Nginx Proxy Manager para Zotero

## ✅ Estado Actual del Servidor

Tu servidor Zotero está funcionando perfectamente:
- ✅ **API**: http://192.168.0.204:3000 
- ✅ **Web**: http://192.168.0.204:8080
- ✅ **Biblioteca**: 50 elementos cargados correctamente

## 🔧 Configuración en Nginx Proxy Manager

### Opción 1: Configuración Simple (Recomendada)

1. **Crear Proxy Host Principal**:
   ```
   Domain Names: zotero.serviciosylaboratoriodomestico.site
   Scheme: http
   Forward Hostname/IP: 192.168.0.204
   Forward Port: 8080
   ✅ Block Common Exploits
   ✅ Websockets Support
   ```

2. **Crear Proxy Host para API** (Opcional - para acceso directo a API):
   ```
   Domain Names: zotero-api.neuropedialab.org  
   Scheme: http
   Forward Hostname/IP: 192.168.0.204
   Forward Port: 3000
   ✅ Block Common Exploits
   ```

### Opción 2: Configuración con Nginx Personalizado

Si prefieres configurar Nginx directamente en el servidor:

1. **Instalar Nginx en el servidor**:
   ```bash
   sudo apt update && sudo apt install -y nginx
   ```

2. **Ejecutar el servidor en modo producción**:
   ```bash
   cd ~/zotero-web-server
   ./start.sh  # Esto configurará Nginx automáticamente
   ```

3. **Configurar Nginx Proxy Manager**:
   ```
   Domain Names: zotero.serviciosylaboratoriodomestico.site
   Scheme: http  
   Forward Hostname/IP: 192.168.0.204
   Forward Port: 80
   ```

## 🧪 Pruebas de Configuración

### Antes de configurar el proxy (funciona ahora):
```bash
# Desde tu red local:
curl -s http://192.168.0.204:8080 | head -5
curl -s http://192.168.0.204:3000/health
```

### Después de configurar el proxy:
```bash
# Desde internet:
curl -s http://zotero.neuropedialab.org | head -5
curl -s http://zotero.neuropedialab.org/api/health  # Si configuraste API
```

## 📱 Configuración JavaScript para el Frontend

El frontend está configurado para funcionar con ambos métodos:

```javascript
// Primero intenta la URL relativa (para proxy)
let response = await fetch('/api/library');
if (!response.ok) {
    // Fallback a localhost directo
    response = await fetch('http://localhost:3000/library');
}
```

## 🔒 Configuración SSL (Opcional)

En Nginx Proxy Manager:
1. Ve a la configuración de tu proxy host
2. Pestaña "SSL"
3. Selecciona "Request a new SSL Certificate"
4. ✅ Force SSL
5. ✅ HTTP/2 Support

## 📊 Monitoreo y Logs

```bash
# Ver estado de servicios
curl http://192.168.0.204:3000/health
curl http://192.168.0.204:8080 | head -5

# Ver logs en tiempo real
tail -f ~/zotero-web-server/logs/api.log
tail -f ~/zotero-web-server/logs/web.log

# Estadísticas de biblioteca  
curl -s http://192.168.0.204:3000/library | jq length
```

## 🔧 Solución de Problemas

### Si el proxy no funciona:
1. Verifica que el servidor esté funcionando: `curl http://192.168.0.204:8080`
2. Verifica la IP del servidor: `hostname -I`
3. Verifica firewall: `sudo ufw status`

### Si necesitas reiniciar:
```bash
cd ~/zotero-web-server
./stop-dev.sh
./start-dev.sh
```

### Si necesitas cambiar puertos:
Edita `start-dev.sh` y cambia los puertos 3000 y 8080 por los que prefieras.

## 🚀 Configuración Recomendada Final

**Para máxima simplicidad**:

1. **Mantén el servidor actual** ejecutándose con `./start-dev.sh`

2. **En Nginx Proxy Manager**:
   ```
   Domain: zotero.neuropedialab.org
   Forward to: http://192.168.0.204:8080
   SSL: Activar Let's Encrypt
   ```

3. **¡Listo!** Accede desde: https://zotero.serviciosylaboratoriodomestico.site

El JavaScript del frontend se adaptará automáticamente a trabajar a través del proxy.

---

**Estado**: ✅ Servidor funcionando, listo para configurar proxy