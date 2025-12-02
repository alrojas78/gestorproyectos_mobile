# Informe de Seguimiento - App Movil Gestion de Proyectos

## Fecha: 2025-12-02 (Actualizado: 02:30 UTC)

---

## Estado Actual: PENDIENTE BUILD - VERSION 1.0.3

**Version anterior:** 1.0.2
**Proxima version:** 1.0.3

---

## ULTIMO FIX (2025-12-02 02:30 UTC) - WEBSOCKET Y MEJORAS UI

### Problemas Identificados
1. **WebSocket no funcionaba en tiempo real** - Los mensajes solo aparecian al refrescar
2. **URL del WebSocket incorrecta** - Faltaba el puerto 3001
3. **Listeners del socket no se registraban** - Se registraban antes de conectar
4. **Orden de tabs incorrecto** - Era Chat, Nueva Tarea, Tareas, Perfil
5. **Boton de debug visible** - Ya no es necesario

### Soluciones Implementadas

#### 1. socketService.js - Correccion WebSocket
```javascript
// ANTES: URL incorrecta
const SOCKET_URL = 'https://d.ateneo.co';

// DESPUES: URL correcta con puerto
const SOCKET_URL = 'https://d.ateneo.co:3001';
```

Tambien se agrego:
- `pendingListeners` para guardar listeners antes de conectar
- Transports: `['websocket', 'polling']` para fallback
- Mejores intentos de reconexion (10 intentos)

#### 2. ChatListScreen.js - Eliminado Debug UI
- Removido boton flotante de debug (bug rojo)
- Removido modal de logs
- Limpieza de imports y estados no usados

#### 3. AppNavigator.js - Orden de Tabs Corregido
```javascript
// ANTES: Chat, Nueva Tarea, Tareas, Perfil
// DESPUES: Chat, Tareas, Nueva Tarea, Perfil
```

#### 4. ChatConversationScreen.js - Mejora Input
- Agregado boton de adjuntar archivos (preparacion para proxima version)
- Diseño mas compacto del area de input
- Listo para implementar adjuntos

---

## FIX ANTERIOR (2025-12-02 00:30 UTC) - PROBLEMA DE CHAT RESUELTO

### Sintomas Reportados (evidencia7.jpg, evidencia8.jpg, evidencia9.jpg)
- Proyectos: FUNCIONAN ✅
- Tareas: FUNCIONAN ✅
- Crear Tarea: FUNCIONA ✅
- Chat: NO FUNCIONA ❌
  - No muestra contactos
  - No muestra chat general
  - Click en proyecto no abre chat

### Diagnostico
Los logs mostraban:
```
Interceptor - Token obtenido {"hasToken":true,"tokenLength":240}
Interceptor - Header Authorization agregado
```
PERO el servidor respondia con errores 401 para los endpoints de chat.

### Causa Raiz Encontrada
El Router del backend en `/var/www/d.ateneo.co/backend/src/routes/api.php` usaba `getallheaders()` directamente en la funcion `getAuthenticatedUser()`, la cual NO funciona correctamente en Apache/FastCGI.

Aunque ya se habia corregido `JWT::getBearerToken()` en jwt.php para manejar multiples fuentes del header Authorization, el Router NO lo estaba usando.

### Solucion Implementada

**Archivo modificado:** `/var/www/d.ateneo.co/backend/src/routes/api.php`

**Antes (linea 615):**
```php
private function getAuthenticatedUser() {
    require_once __DIR__ . '/../config/jwt.php';
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        // ...error
    }
    $token = $matches[1];
    // ...
}
```

**Despues:**
```php
private function getAuthenticatedUser() {
    require_once __DIR__ . '/../config/jwt.php';

    // Usar el metodo robusto de JWT para obtener el token
    $token = JWT::getBearerToken();

    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token no proporcionado']);
        exit;
    }
    // ...
}
```

### Verificacion con curl
Despues del fix, todos los endpoints de chat responden correctamente:

```bash
# Usuarios/Contactos
curl -H "Authorization: Bearer $TOKEN" "https://d.ateneo.co/backend/api/users/online-status"
# Respuesta: {"success":true,"users":[...]} ✅

# Conversaciones
curl -H "Authorization: Bearer $TOKEN" "https://d.ateneo.co/backend/api/conversations"
# Respuesta: {"success":true,"conversations":[...]} ✅

# Chat General
curl -H "Authorization: Bearer $TOKEN" "https://d.ateneo.co/backend/api/conversations/general"
# Respuesta: {"success":true,"conversation":{...}} ✅

# Chat de Proyecto
curl -H "Authorization: Bearer $TOKEN" "https://d.ateneo.co/backend/api/projects/18/conversation"
# Respuesta: {"success":true,"conversation":{...}} ✅
```

---

## Historial de Problemas y Soluciones (Resumen Cronologico)

### Problema 1: Token no se guarda correctamente en Android (evidencia1, evidencia2)
- **Causa:** SecureStore asincrono, `getItemAsync` retornaba false inmediatamente despues de `setItemAsync`
- **Solucion:** Memory cache en storage.js

### Problema 2: 401 persiste a pesar del memory cache (evidencia3-6)
- **Causa:** El token se guardaba pero las llamadas API no lo recibian correctamente
- **Solucion:** Debug logging en el interceptor de axios

### Problema 3: Token SI se envia pero servidor rechaza (evidencia7-9)
- **Causa:** Apache filtraba el header Authorization antes de llegar a PHP
- **Solucion:** Modificar .htaccess con RewriteRule y SetEnvIf

### Problema 4: Proyectos/Tareas funcionan pero Chat no (ACTUAL)
- **Causa:** Router usaba `getallheaders()` en vez de `JWT::getBearerToken()`
- **Solucion:** Modificar `getAuthenticatedUser()` en api.php

---

## Archivos Modificados en Backend (Total)

### 1. /var/www/d.ateneo.co/backend/.htaccess
```apache
RewriteEngine On

# Pasar el header Authorization a PHP (necesario para JWT)
RewriteCond %{HTTP:Authorization} ^(.*)
RewriteRule .* - [e=HTTP_AUTHORIZATION:%1]

# Tambien configurar para CGI/FastCGI
SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1

RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [QSA,L]
```

### 2. /var/www/d.ateneo.co/backend/src/config/jwt.php
Metodo `getBearerToken()` que busca Authorization en:
1. `apache_request_headers()`
2. `$_SERVER['HTTP_AUTHORIZATION']`
3. `$_SERVER['REDIRECT_HTTP_AUTHORIZATION']`
4. `getallheaders()`

### 3. /var/www/d.ateneo.co/backend/src/routes/api.php
`getAuthenticatedUser()` ahora usa `JWT::getBearerToken()`

---

## Commits Realizados

### Backend (main)
```
e3e8901 fix: use JWT::getBearerToken() in Router for consistent auth header handling
```

### Mobile App (master)
```
01a9937 bump version to 1.0.2
3363e32 chore: v1.0.1 - debug logging in axios interceptor
c1a387c fix: add memory cache to storage + don't auto-delete token on 401
```

---

## Historial de Builds

| Fecha | Version | Build ID | Estado | Cambios |
|-------|---------|----------|--------|---------|
| 2025-12-02 02:30 | 1.0.3 | PENDIENTE | - | WebSocket fix, UI cleanup |
| 2025-12-02 00:32 | 1.0.2 | 5ec7fb87-... | OK | Backend auth fix |
| 2025-12-02 00:05 | 1.0.1 | 4e01d1dc-... | OK | Debug logging interceptor |
| 2025-12-01 23:51 | 1.0.0 | ... | OK | Memory cache + fix interceptor 401 |

---

## Credenciales Expo/EAS

- **Email:** alexanderrojas78@gmail.com
- **Usuario:** alrojas78
- **Token:** E3Kh81dSYzm9rHHUcY_Us0BdrJWeye9PkK1CmByz
- **Proyecto:** https://expo.dev/accounts/alrojas78/projects/sprints-diarios

---

## Comandos Utiles

```bash
# Generar nuevo APK
cd /var/www/d.ateneo.co/mobile-app
export EXPO_TOKEN="E3Kh81dSYzm9rHHUcY_Us0BdrJWeye9PkK1CmByz"
eas build -p android --profile preview --non-interactive

# Ver builds
eas build:list

# Probar endpoints de chat
TOKEN="[tu_token]"
curl -H "Authorization: Bearer $TOKEN" "https://d.ateneo.co/backend/api/users/online-status"
curl -H "Authorization: Bearer $TOKEN" "https://d.ateneo.co/backend/api/conversations"
curl -H "Authorization: Bearer $TOKEN" "https://d.ateneo.co/backend/api/conversations/general"
```

---

## Endpoints del Backend

| Endpoint | Formato Respuesta | Usado en |
|----------|------------------|----------|
| POST /login | `{token, user}` | AuthContext |
| GET /me | `{user object}` | AuthContext |
| GET /users/online-status | `{success, users: [...]}` | ChatListScreen |
| GET /conversations | `{success, conversations: [...]}` | ChatListScreen |
| GET /conversations/general | `{success, conversation: {...}}` | ChatListScreen |
| GET /projects/{id}/conversation | `{success, conversation: {...}}` | ChatListScreen |
| GET /projects | `[{...}]` (array directo) | ChatListScreen, CreateTaskScreen |
| GET /teams | `[{...}]` (array directo) | TasksListScreen |
| GET /teams/{id}/open-tasks | `[{...}]` (array directo) | TasksListScreen |
| GET /teams/{id}/members | `[{...}]` (array directo) | CreateTaskScreen |
| GET /projects/{id}/sprints | `[{...}]` (array directo) | CreateTaskScreen |
| POST /conversations | `{success, conversation: {...}}` | ChatListScreen |

---

## Estructura del Proyecto

```
/var/www/d.ateneo.co/mobile-app/
├── App.js                 # Entry point
├── app.json               # Configuracion Expo (version 1.0.2)
├── eas.json               # Configuracion EAS Build
├── package.json
├── src/
│   ├── context/
│   │   └── AuthContext.js    # Manejo de autenticacion
│   ├── navigation/
│   │   └── AppNavigator.js   # Navegacion con tabs
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── ChatListScreen.js
│   │   ├── ChatConversationScreen.js
│   │   ├── TasksListScreen.js
│   │   ├── TaskDetailScreen.js
│   │   ├── CreateTaskScreen.js
│   │   └── ProfileScreen.js
│   └── services/
│       ├── api.js            # Cliente axios + endpoints
│       ├── storage.js        # Wrapper SecureStore/localStorage + memory cache
│       ├── debugLogger.js    # Logging para debug en app
│       └── socketService.js  # WebSocket para chat
└── DEVELOPMENT_LOG.md        # Este archivo
```

---

## Roadmap de Versiones

### Version 1.0.3 (Actual - Pendiente Build)
- [x] Login/Autenticacion
- [x] Chat (contactos, conversaciones, proyectos, chat general)
- [x] Tareas (listado por equipo, filtros)
- [x] Crear tarea
- [x] Perfil
- [x] Compatibilidad web para debug
- [x] Memory cache para token
- [x] Fix backend Authorization header
- [x] Fix WebSocket URL (puerto 3001)
- [x] Fix listeners del socket
- [x] Orden de tabs corregido
- [x] UI de debug removida
- [x] Boton de adjuntar preparado
- [ ] **Pendiente:** Generar APK y validar

### Version 1.1.0 (Proxima)
- [ ] Adjuntar archivos en chat
- [ ] Notificaciones push

### Version 2.0 (Planificada)
- [ ] Llamadas de audio (WebRTC)
- [ ] Videollamadas
- [ ] Llamadas grupales
- [ ] Compartir pantalla

---

## Notas Adicionales

- **App web funciona:** https://d.ateneo.co
- **Backend PHP:** `/var/www/d.ateneo.co/backend`
- **Frontend web React:** `/var/www/d.ateneo.co/frontend`
- **App movil:** `/var/www/d.ateneo.co/mobile-app`
- **Base de datos:** MySQL en AWS RDS
- **Usuario de prueba:** streaming@ateneo.co / 1Aprende.4*
