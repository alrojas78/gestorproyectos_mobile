# Informe de Seguimiento - App Movil Gestion de Proyectos

## Fecha: 2025-12-02 (Actualizado: 02:30 UTC)

---

## Estado Actual: PENDIENTE BUILD - VERSION 1.0.3

**Version anterior:** 1.0.2
**Proxima version:** 1.0.3

---

## PROBLEMA PENDIENTE (2025-12-02 03:30 UTC) - ARQUITECTURA DE MENSAJES

### Estado: REQUIERE CORRECCION

### Descripcion del Problema
Los mensajes enviados desde la app **se guardan correctamente** en la base de datos (via API REST),
pero **NO se emiten en tiempo real** a otros clientes.

### Diagnostico Realizado
Al revisar los logs del WebSocket (`pm2 logs websocket-chat`), el mensaje "Hola mundo dos"
enviado desde la app **NO aparece** en los logs del servidor WebSocket.

Esto confirma que:
1. La app envia mensajes via **API REST** (PHP backend) - FUNCIONA
2. El mensaje se guarda en la base de datos - FUNCIONA
3. Pero el **WebSocket server (Node.js) NO es notificado** - NO FUNCIONA
4. Por lo tanto, otros clientes no reciben el mensaje en tiempo real

### Causa Raiz
Hay **DOS sistemas separados** que no se comunican:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   App Movil     │────>│  Backend PHP     │────>│   MySQL DB      │
│  (React Native) │     │  (API REST)      │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              │ NO HAY CONEXION
                              ▼
┌─────────────────┐     ┌──────────────────┐
│   Frontend Web  │<───>│  WebSocket       │
│   (React)       │     │  Server (Node)   │
└─────────────────┘     └──────────────────┘
```

**El Backend PHP no notifica al WebSocket Server cuando se guarda un mensaje.**

### Solucion Requerida (Opciones)

#### Opcion A: App envia SOLO por WebSocket (Recomendada)
Modificar `ChatConversationScreen.js` para que la app envie mensajes **solo via WebSocket**,
igual que la web. El WebSocket server ya guarda en DB y emite a todos.

```javascript
// ACTUAL (incorrecto)
const response = await chatApi.sendMessage(conversationId, messageText); // API REST
if (socketService.isConnected()) {
  socketService.sendMessage(conversationId, messageText); // WebSocket (redundante)
}

// CORRECTO
socketService.sendMessage(conversationId, messageText); // Solo WebSocket
```

#### Opcion B: Backend PHP notifica a WebSocket
Modificar el backend PHP para que cuando guarde un mensaje,
notifique al servidor WebSocket via HTTP o Redis pub/sub.

### Archivos a Modificar

**Para Opcion A (recomendada):**
- `/var/www/d.ateneo.co/mobile-app/src/screens/ChatConversationScreen.js`
  - Cambiar `sendMessage()` para usar solo WebSocket
  - Agregar manejo de errores si WebSocket falla

### Verificacion del Problema
1. Enviar mensaje desde app
2. Ejecutar: `pm2 logs websocket-chat`
3. Si NO aparece `[SEND_MESSAGE]`, el mensaje fue por API REST, no WebSocket
4. Si aparece `[SEND_MESSAGE]`, el WebSocket funciona

---

## FIX ANTERIOR (2025-12-02 03:00 UTC) - WEBSOCKET CORRECIONES

### Build Completado
**Build ID:** 47cd83dc-861b-4a4b-bca7-a3aa87eba9e4
**URL:** https://expo.dev/accounts/alrojas78/projects/sprints-diarios/builds/47cd83dc-861b-4a4b-bca7-a3aa87eba9e4

### Logs de Diagnostico en Servidor WebSocket
Se agregaron logs detallados al servidor para diagnosticar problemas.

**Ver logs en tiempo real:**
```bash
pm2 logs websocket-chat
```

**Logs disponibles:**
- `[JOIN_CONVERSATION]` - Cuando un usuario se une a una sala de chat
- `[SEND_MESSAGE]` - Cuando se envia un mensaje
- Cantidad de sockets en cada sala de conversacion

### Problemas Identificados
1. **WebSocket no funcionaba en tiempo real** - Los mensajes solo aparecian al refrescar
2. **URL del WebSocket incorrecta** - Faltaba el puerto 3001
3. **Campos con formato incorrecto** - App usaba snake_case, servidor espera camelCase
4. **Handler de mensajes incorrecto** - Esperaba `data.message` pero servidor envia mensaje directo
5. **Evento typing incorrecto** - Usaba `user_typing` pero servidor emite `typing`
6. **Orden de mensajes invertido** - Se hacia reverse() innecesario
7. **join_conversation se perdia** - Se llamaba antes de que socket conectara

### Soluciones Implementadas

#### 1. socketService.js - Correccion Completa WebSocket

**URL corregida:**
```javascript
const SOCKET_URL = 'https://d.ateneo.co:3001';
```

**Campos cambiados a camelCase (como espera el servidor):**
```javascript
// ANTES (incorrecto)
this.socket.emit('send_message', { conversation_id, content, message_type });

// DESPUES (correcto)
this.socket.emit('send_message', { conversationId, content, messageType });
```

**Cola de emits pendientes (nuevo):**
```javascript
pendingEmits = []; // Guarda join_conversation, send_message cuando no hay conexion

joinConversation(conversationId) {
  if (this.socket?.connected) {
    this.socket.emit('join_conversation', { conversationId });
  } else {
    // Guardar para ejecutar cuando se conecte
    this.pendingEmits.push({ event: 'join_conversation', data: { conversationId } });
    this.connect(); // Intentar conectar
  }
}
```

#### 2. ChatConversationScreen.js - Handler de Mensajes Corregido

**Handler new_message corregido:**
```javascript
// ANTES (incorrecto)
const handleNewMessage = (data) => {
  if (data.conversation_id === conversationId) {
    setMessages((prev) => [...prev, data.message]);
  }
};

// DESPUES (correcto)
const handleNewMessage = (message) => {
  const msgConversationId = message.conversationId || message.conversation_id;
  if (String(msgConversationId) === String(conversationId)) {
    // Deteccion de duplicados incluida
    setMessages((prev) => [...prev, message]);
  }
};
```

**Evento typing corregido:**
```javascript
// ANTES: socketService.on('user_typing', handleTyping);
// DESPUES: socketService.on('typing', handleTyping);
```

**Orden de mensajes:**
```javascript
// ANTES: setMessages(data.reverse()); // INCORRECTO
// DESPUES: setMessages(data); // Backend ya ordena cronologicamente
```

#### 3. Mejoras UI (del fix anterior)
- Boton de debug removido
- Orden de tabs: Chat, Tareas, Nueva Tarea, Perfil
- Boton de adjuntar preparado en input

---

## FIX ANTERIOR (2025-12-02 02:30 UTC) - UI Y NAVEGACION

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
| 2025-12-02 03:00 | 1.0.3 | 47cd83dc-... | EN PROGRESO | WebSocket tiempo real completo |
| 2025-12-02 02:40 | 1.0.3 | a544a7ba-... | OK | UI cleanup, tabs reordenados |
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
