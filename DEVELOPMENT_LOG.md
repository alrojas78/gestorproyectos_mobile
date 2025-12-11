# Informe de Seguimiento - App Movil Gestion de Proyectos

## Fecha: 2025-12-11 (Actualizado: 23:00 UTC)

---

## Estado Actual: NOTIFICACIONES PUSH FUNCIONANDO - VERSION 1.0.11

**Version anterior:** 1.0.10
**Version actual:** 1.0.11

---

## CONFIGURACION FIREBASE/FCM (2025-12-11) - COMPLETADO

### Estado: FUNCIONANDO

### Descripcion
Se configuro Firebase Cloud Messaging (FCM) para habilitar las notificaciones push
cuando la app esta cerrada o en segundo plano.

### Credenciales Firebase

**Proyecto Firebase:** ateneo-sprints
- **Console:** https://console.firebase.google.com/project/ateneo-sprints
- **Project Number:** 535084204666
- **Package Android:** co.ateneo.sprints

**Archivos de Credenciales:**
- `/var/www/d.ateneo.co/mobile-app/google-services.json` - Config Firebase para Android
- `/var/www/d.ateneo.co/websocket-server/config/firebase-service-account.json` - Service Account
- `/var/www/d.ateneo.co/docs/ateneo-keystore.jks` - Android Keystore (password: ateneo2025)
- `/var/www/d.ateneo.co/docs/ateneo-sprints-firebase-adminsdk-fbsvc-8926f9684c.json` - Backup Service Account

### Credenciales Expo FCM (subidas via GraphQL API)
- **Google Service Account Key ID:** 7950b6c3-483f-4349-87c1-078f630bc01e
- **Android App Credentials ID:** 204ba058-b735-4d71-8da1-9e5dc058317f
- **Account ID (menntunsas):** 58e23488-1521-40d3-a1f3-9db2f88b6f91

### Configuracion en app.json
```json
{
  "android": {
    "googleServicesFile": "./google-services.json"
  }
}
```

### Test de Notificacion Push
```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[TOKEN_AQUI]",
    "title": "Test",
    "body": "Mensaje de prueba"
  }'
```

---

## NUEVA FUNCIONALIDAD (2025-12-11) - NOTIFICACIONES PUSH

### Estado: COMPLETADO - VERSION 1.0.11

### Descripcion
Se implemento el sistema completo de notificaciones push para la app movil,
permitiendo recibir alertas de nuevos mensajes cuando la app esta cerrada o en segundo plano.

### Componentes Implementados

#### 1. Servicio de Notificaciones (notificationService.js)
- Registro para push notifications con Expo
- Solicitud de permisos al usuario
- Obtencion de Expo Push Token
- Configuracion de canales de Android:
  - `default`: Notificaciones generales
  - `chat`: Mensajes de chat (alta prioridad)
  - `tasks`: Notificaciones de tareas
  - `support`: Soporte al cliente (alta prioridad)
- Listeners para notificaciones recibidas y tocadas
- Gestion de badge count

#### 2. Integracion en AuthContext
- Registro automatico de push token al login/checkAuth
- Envio de token al servidor con info del dispositivo
- Desactivacion del token al logout
- Limpieza de listeners al cerrar sesion

#### 3. Backend PHP
- Nueva tabla `push_tokens` en la base de datos
- Modelo `PushToken.php` para gestion de tokens
- Controlador `PushNotificationController.php`
- Endpoints:
  - `POST /api/push-token`: Registrar token
  - `DELETE /api/push-token`: Desactivar token
  - `GET /api/push-tokens`: Listar tokens (debug)
- Metodo estatico para enviar push via Expo Push API

#### 4. WebSocket Server
- Nuevo servicio `pushService.js`
- Integracion con `chatHandler.js`
- Envio automatico de push a usuarios offline cuando reciben mensaje
- Deteccion de usuarios offline via `userSockets` Map

#### 5. Actualizacion de App.js
- Inicializacion de listeners de notificaciones
- Navegacion automatica al tocar notificacion:
  - Mensajes de chat -> ChatConversation
  - Mensajes de soporte -> SupportConversation
- Limpieza de badge al abrir la app

### Archivos Nuevos
- `/src/services/notificationService.js`
- `/backend/src/models/PushToken.php`
- `/backend/src/controllers/PushNotificationController.php`
- `/backend/migrations/create_push_tokens_table.sql`
- `/websocket-server/services/pushService.js`

### Archivos Modificados
- `/src/services/api.js` - Agregado pushApi
- `/src/context/AuthContext.js` - Registro de push token
- `/src/navigation/AppNavigator.js` - Soporte para navigationRef
- `/App.js` - Inicializacion de notificaciones
- `/app.json` - Version 1.0.7, configuracion expo-notifications
- `/backend/src/routes/api.php` - Rutas de push token
- `/websocket-server/handlers/chatHandler.js` - Envio de push a offline

### Flujo de Notificaciones
```
1. Usuario hace login -> Se registra push token en servidor
2. Usuario cierra app -> Estado offline en WebSocket
3. Otro usuario envia mensaje
4. WebSocket detecta destinatario offline
5. WebSocket server envia push via Expo Push API
6. Dispositivo muestra notificacion
7. Usuario toca notificacion -> App abre y navega a conversacion
```

---

## FIX CRITICO (2025-12-10) - URL DE WEBSOCKET INCORRECTA

### Estado: CORREGIDO - PENDIENTE BUILD

### Problema Identificado
Los mensajes enviados desde la app movil NO llegaban en tiempo real a otros clientes,
y los mensajes enviados desde la web NO llegaban a la app movil.

### Causa Raiz
La app movil estaba configurada para conectar directamente a `https://d.ateneo.co:3001`,
pero el servidor WebSocket Node.js NO tiene SSL configurado directamente.

La web funciona porque usa el proxy de Apache:
```
wss://d.ateneo.co/socket.io -> ws://localhost:3001/socket.io
```

La app estaba intentando conectar directamente al puerto 3001 sin pasar por el proxy.

### Solucion Implementada
Se cambio la URL de WebSocket en `socketService.js`:

**Antes (incorrecto):**
```javascript
const SOCKET_URL = 'https://d.ateneo.co:3001';
```

**Despues (correcto):**
```javascript
const SOCKET_URL = 'wss://d.ateneo.co';
```

### Por que funciona ahora
- `wss://d.ateneo.co` usa el puerto 443 (HTTPS/WSS)
- Apache maneja SSL y redirige `/socket.io/*` a `localhost:3001`
- El proxy de Apache esta configurado asi:
```apache
RewriteRule ^/socket.io/(.*) ws://localhost:3001/socket.io/$1 [P,L]
ProxyPass /socket.io http://localhost:3001/socket.io
ProxyPassReverse /socket.io http://localhost:3001/socket.io
```

### Archivo Modificado
- `/src/services/socketService.js` - Linea 5

---

## NUEVA FUNCIONALIDAD (2025-12-10) - SISTEMA DE SOPORTE

### Estado: PENDIENTE BUILD

### Descripcion
Se integro el sistema de soporte al cliente en la app movil, permitiendo a los agentes
atender las consultas de clientes externos directamente desde el dispositivo movil.

### Cambios Realizados

#### 1. API de Soporte (api.js)
- Nuevo objeto `supportApi` con endpoints para:
  - `getSessions()` - Listar sesiones de soporte
  - `getSession(id)` - Obtener detalles de sesion
  - `getSessionMessages(id)` - Mensajes de una sesion
  - `sendMessage(id, content)` - Enviar mensaje como agente
  - `assignSession(id)` - Asignar sesion al agente
  - `closeSession(id)` - Cerrar sesion
  - `escalateSession(id, data)` - Escalar sesion
  - `markSessionAsRead(id)` - Marcar como leida
  - `toggleSessionAI(id, enable)` - Activar/desactivar IA
  - `getUnreadTotal()` - Total de mensajes no leidos
  - `getChannels()` - Canales de soporte

#### 2. Eventos de Socket (socketService.js)
- `connectAsAgent()` - Conectar como agente de soporte
- `joinSupportSession(sessionId)` - Unirse a sesion
- `leaveSupportSession(sessionId)` - Salir de sesion
- `sendSupportMessage(sessionId, content)` - Enviar mensaje
- `sendSupportTyping(sessionId)` - Indicador de escritura
- `closeSupportSession(sessionId)` - Cerrar sesion via socket

#### 3. Nuevas Pantallas
- **SupportListScreen.js** - Lista de sesiones de soporte con:
  - Filtros: Activas, Esperando, Escaladas, Todas
  - Badges de estado (Bot, Agente, Escalada)
  - Contador de mensajes no leidos
  - Actualizacion en tiempo real via WebSocket

- **SupportConversationScreen.js** - Conversacion de soporte con:
  - Mensajes diferenciados por tipo (cliente, agente, IA, sistema)
  - Acciones: Asignar, Escalar, Cerrar sesion
  - Indicador de "escribiendo..."
  - Info del cliente (email, telefono)
  - Envio de mensajes via WebSocket

#### 4. Integracion en ChatListScreen
- Boton de soporte en header con badge de no leidos
- Listener de eventos WebSocket para notificaciones
- Navegacion a pantalla de soporte

#### 5. Navegacion (AppNavigator.js)
- Nuevas rutas: SupportList, SupportConversation

### Archivos Modificados
- `/src/services/api.js` - Agregado supportApi
- `/src/services/socketService.js` - Eventos de soporte
- `/src/screens/ChatListScreen.js` - Boton de soporte
- `/src/navigation/AppNavigator.js` - Rutas de soporte

### Archivos Nuevos
- `/src/screens/SupportListScreen.js`
- `/src/screens/SupportConversationScreen.js`

---

## FIX APLICADO (2025-12-02 ~14:00 UTC) - MENSAJES TIEMPO REAL

### Estado: CORREGIDO - PENDIENTE BUILD

### Problema Resuelto
Los mensajes enviados desde la app **se guardaban** en la base de datos (via API REST),
pero **NO se emitian en tiempo real** a otros clientes porque usaba API REST en lugar de WebSocket.

### Causa Raiz Identificada
La funcion `sendMessage()` en `ChatConversationScreen.js` hacia:
1. **Primero** enviaba por API REST (guardaba en DB pero no notificaba WebSocket)
2. **Despues** enviaba por WebSocket (pero el mensaje ya estaba duplicado)

El Backend PHP no notificaba al WebSocket Server, causando que los mensajes no llegaran en tiempo real.

### Solucion Implementada (Opcion A)
Se modifico `ChatConversationScreen.js` para enviar mensajes **SOLO por WebSocket**,
con fallback a API REST si el WebSocket no esta conectado.

**Codigo anterior (incorrecto):**
```javascript
const response = await chatApi.sendMessage(conversationId, messageText); // API REST
if (socketService.isConnected()) {
  socketService.sendMessage(conversationId, messageText); // WebSocket (redundante)
}
```

**Codigo nuevo (correcto):**
```javascript
if (socketService.isConnected()) {
  socketService.sendMessage(conversationId, messageText); // Solo WebSocket
  // El mensaje real llegara via evento 'new_message'
} else {
  // Fallback: API REST si WebSocket no conectado
  const response = await chatApi.sendMessage(conversationId, messageText);
}
```

### Flujo Correcto Ahora
```
App Movil ─────> WebSocket Server ─────> MySQL DB
                      │
                      └─────> Emite a TODOS los clientes conectados (tiempo real)
```

### Verificacion
1. Enviar mensaje desde app movil
2. Ejecutar: `pm2 logs websocket-chat`
3. Debe aparecer `[SEND_MESSAGE]` en los logs
4. El mensaje debe llegar en tiempo real a otros clientes (web y movil)

---

## PROBLEMA ANTERIOR (2025-12-02 03:30 UTC) - ARQUITECTURA DE MENSAJES

### Estado: RESUELTO (ver fix arriba)

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

| Fecha | Version | Build ID | Estado | Cuenta | Cambios |
|-------|---------|----------|--------|--------|---------|
| 2025-12-11 | 1.0.11 | - | OK | menntunsas | **Firebase FCM + Push Notifications funcionando** |
| 2025-12-11 | 1.0.10 | - | OK | menntunsas | Debug alerts para push token |
| 2025-12-11 | 1.0.9 | - | OK | menntunsas | Hardcoded projectId fallback |
| 2025-12-11 | 1.0.8 | 9ce82e88-... | OK | menntunsas | Build con cuenta alternativa |
| 2025-12-11 | 1.0.7 | a4c8839b-... | OK | alrojas78 | Notificaciones Push (sin FCM) |
| 2025-12-10 | 1.0.6 | e1eeb132-... | OK | alrojas78 | FIX WebSocket URL + Sistema de Soporte |
| 2025-12-02 | 1.0.3 | 47cd83dc-... | OK | alrojas78 | WebSocket tiempo real completo |
| 2025-12-02 | 1.0.2 | 5ec7fb87-... | OK | alrojas78 | Backend auth fix |
| 2025-12-02 | 1.0.1 | 4e01d1dc-... | OK | alrojas78 | Debug logging interceptor |
| 2025-12-01 | 1.0.0 | - | OK | alrojas78 | Version inicial |

---

## Credenciales Expo/EAS

### Cuenta Principal
- **Email:** alexanderrojas78@gmail.com
- **Usuario:** alrojas78
- **Token:** E3Kh81dSYzm9rHHUcY_Us0BdrJWeye9PkK1CmByz
- **Proyecto:** https://expo.dev/accounts/alrojas78/projects/sprints-diarios

### Cuenta Alternativa (usar cuando la principal agote creditos gratuitos)
- **Usuario:** menntunsas
- **Token:** jGVe3gPd1_TIn7eXjPrwHNf8uKmFeu46t-fi6ECR
- **Proyecto:** https://expo.dev/accounts/menntunsas/projects/sprints-diarios
- **Project ID:** fa1e8874-bef6-4eeb-a745-bc0c62dbe6b7

**NOTA:** Para cambiar de cuenta, modificar el `app.json`:
- Cambiar `owner` al usuario deseado
- Cambiar `extra.eas.projectId` al ID del proyecto correspondiente

---

## Comandos Utiles

```bash
# Generar nuevo APK (Cuenta Principal - alrojas78)
cd /var/www/d.ateneo.co/mobile-app
export EXPO_TOKEN="E3Kh81dSYzm9rHHUcY_Us0BdrJWeye9PkK1CmByz"
eas build -p android --profile preview --non-interactive

# Generar nuevo APK (Cuenta Alternativa - menntunsas)
cd /var/www/d.ateneo.co/mobile-app
export EXPO_TOKEN="jGVe3gPd1_TIn7eXjPrwHNf8uKmFeu46t-fi6ECR"
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

### Version 1.0.11 (Actual - FUNCIONANDO)
- [x] Login/Autenticacion
- [x] Chat (contactos, conversaciones, proyectos, chat general)
- [x] Tareas (listado por equipo, filtros)
- [x] Crear tarea
- [x] Perfil
- [x] Compatibilidad web para debug
- [x] Memory cache para token
- [x] Fix backend Authorization header
- [x] Fix WebSocket URL - Cambiado a `wss://d.ateneo.co`
- [x] **Sistema de Soporte** - Atencion a clientes externos desde la app
- [x] **Notificaciones Push FUNCIONANDO**
  - Firebase Cloud Messaging configurado
  - google-services.json integrado
  - Credenciales FCM subidas a Expo
  - Push notifications probadas y funcionando

### Version 1.1.0 (Proxima)
- [ ] Adjuntar archivos en chat
- [ ] Remover debug alerts de AuthContext.js y notificationService.js

### Version 2.0 (Planificada)
- [ ] Llamadas de audio (WebRTC)
- [ ] Videollamadas
- [ ] Llamadas grupales
- [ ] Compartir pantalla

### Notas para Publicacion en Stores
- **Play Store (Android):** Las credenciales FCM ya estan configuradas. Solo necesita build de produccion.
- **App Store (iOS):** Requiere cuenta Apple Developer ($99/año) y configurar APNs (Apple Push Notifications).

---

## Notas Adicionales

- **App web funciona:** https://d.ateneo.co
- **Backend PHP:** `/var/www/d.ateneo.co/backend`
- **Frontend web React:** `/var/www/d.ateneo.co/frontend`
- **App movil:** `/var/www/d.ateneo.co/mobile-app`
- **Base de datos:** MySQL en AWS RDS
- **Usuario de prueba:** streaming@ateneo.co / 1Aprende.4*
