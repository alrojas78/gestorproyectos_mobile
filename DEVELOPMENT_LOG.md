# Informe de Seguimiento - App Movil Gestion de Proyectos

## Fecha: 2025-12-01 (Actualizado: 23:51 UTC)

---

## Estado Actual: BUILD EN COLA

**Build ID:** 4e01d1dc-6652-44df-a073-3368d0df129c
**Commit:** c1a387c
**URL:** https://expo.dev/accounts/alrojas78/projects/sprints-diarios/builds/4e01d1dc-6652-44df-a073-3368d0df129c

---

## Ultimo Fix (2025-12-01 23:51 UTC)

### Problema Detectado en APK
Despues de compilar con el fix de storage wrapper, el APK seguia mostrando errores 401.

### Analisis de Logs de Debug (evidencia1.jpg, evidencia2.jpg)
Los logs mostraron claramente el problema:
1. Login exitoso - token recibido del servidor
2. `setItemAsync` llamado para guardar token
3. Inmediatamente despues `getItemAsync` retorna `hasValue: false`
4. Las llamadas API van sin token -> Error 401
5. El interceptor de 401 borraba el token automaticamente (empeorando el problema)

### Causa Raiz
**Problema de timing con SecureStore en Android.** El `setItemAsync` de expo-secure-store es asincrono y no garantiza que el valor este disponible inmediatamente para `getItemAsync`. Esto es especialmente problematico con `newArchEnabled: true`.

### Solucion Implementada

#### 1. storage.js - Memory Cache Layer
Se agrego una capa de cache en memoria que:
- Guarda el valor en memoria INMEDIATAMENTE en `setItemAsync`
- `getItemAsync` primero busca en memoria, luego en SecureStore
- Esto garantiza acceso instantaneo al token despues del login

```javascript
const memoryCache = {};

// En setItemAsync:
memoryCache[key] = value;  // Instantaneo
await SecureStore.setItemAsync(key, value);  // Async

// En getItemAsync:
if (memoryCache[key]) return memoryCache[key];  // Cache hit
return await SecureStore.getItemAsync(key);  // Fallback
```

#### 2. api.js - Interceptor 401 Fix
Se elimino el borrado automatico del token en errores 401:
- Antes: Cualquier 401 borraba el token inmediatamente
- Ahora: Solo se loguea el error, el logout explicito maneja el borrado

---

## Problema Original

La app movil en React Native/Expo no funcionaba correctamente despues del login:
- Chat mostraba "No hay contactos"
- Tareas se quedaba cargando infinitamente o mostraba error
- Nueva Tarea mostraba "No hay proyectos disponibles"
- Solo funcionaba el formulario de login y el perfil

---

## Diagnostico Realizado (2025-12-01)

### Metodo de Debug
Se configuro Expo para correr en modo web (`expo start --web`) permitiendo ver la consola del navegador.

### Error Encontrado
```
ExpoSecureStore.default.getValueWithKeyAsync is not a function
```

**Causa raiz:** `expo-secure-store` no funciona en web. Esto causaba que el token de autenticacion no se guardara/recuperara correctamente, haciendo que todas las llamadas a la API fallaran con 401.

### Verificacion de APIs
Se verifico con curl que todas las APIs funcionan correctamente:
- `GET /users/online-status` → 9 usuarios ✅
- `GET /conversations` → 8 conversaciones ✅
- `GET /conversations/general` → Chat general existe ✅
- `GET /projects` → 6 proyectos ✅
- `GET /teams` → 2 equipos ✅
- `GET /teams/1/open-tasks` → Tareas del equipo ✅

**Conclusion:** El backend funciona perfectamente. El problema era solo en la app movil.

---

## Solucion Implementada

### 1. storage.js (NUEVO)
**Archivo:** `/var/www/d.ateneo.co/mobile-app/src/services/storage.js`

Wrapper de almacenamiento que detecta la plataforma:
- **Web:** usa `localStorage`
- **Mobile:** usa `expo-secure-store`

```javascript
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const storage = {
  async getItemAsync(key) {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  // ... setItemAsync, deleteItemAsync
};
```

### 2. api.js (Actualizado)
- Cambiado de `import * as SecureStore` a `import storage from './storage'`
- Todos los `SecureStore.getItemAsync` cambiados a `storage.getItemAsync`

### 3. AuthContext.js (Actualizado)
- Cambiado de `import * as SecureStore` a `import storage from '../services/storage'`
- Todas las llamadas a SecureStore ahora usan el wrapper

### 4. Screens (Sin cambios de logica)
Los archivos `ChatListScreen.js`, `TasksListScreen.js`, `CreateTaskScreen.js` ya tenian la logica correcta desde los cambios anteriores.

---

## Cambios Anteriores (Referencia)

### api.js
- `API_BASE_URL` = `https://d.ateneo.co/backend/api`
- Funcion `extractData()` para manejar ambos formatos de respuesta:
  - Arrays directos: `[{...}, {...}]`
  - Objetos con success: `{success: true, data: [...]}`
- Timeout de 30 segundos

### ChatListScreen.js
- 3 tabs: Contactos, Recientes, Proyectos
- Chat General visible al inicio
- Usuarios ordenados: online primero

### TasksListScreen.js
- Selector de equipos horizontal
- Seleccion automatica del equipo del usuario
- Filtros: Todas, Mis Tareas, Pendientes

### CreateTaskScreen.js
- Carga proyectos activos
- Carga sprints no cerrados
- Carga miembros del equipo

---

## Endpoints del Backend

| Endpoint | Formato Respuesta | Usado en |
|----------|------------------|----------|
| POST /login | `{token, user}` | AuthContext |
| GET /me | `{user object}` | AuthContext |
| GET /users/online-status | `{success, users: [...]}` | ChatListScreen |
| GET /conversations | `{success, conversations: [...]}` | ChatListScreen |
| GET /conversations/general | `{success, conversation: {...}}` | ChatListScreen |
| GET /projects | `[{...}]` (array directo) | ChatListScreen, CreateTaskScreen |
| GET /teams | `[{...}]` (array directo) | TasksListScreen |
| GET /teams/{id}/open-tasks | `[{...}]` (array directo) | TasksListScreen |
| GET /teams/{id}/members | `[{...}]` (array directo) | CreateTaskScreen |
| GET /projects/{id}/sprints | `[{...}]` (array directo) | CreateTaskScreen |
| POST /conversations | `{success, conversation: {...}}` | ChatListScreen |

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

# Cancelar un build
eas build:cancel [BUILD_ID]

# Debug en navegador web
npm run web
# o
npx expo start --web

# Ver logs de un build
eas build:view [BUILD_ID]
```

---

## Debug: Si Persisten Errores

### 1. Verificar en navegador web primero
```bash
cd /var/www/d.ateneo.co/mobile-app
npx expo start --web --port 19006
```
Abrir http://localhost:19006, F12 para ver consola.

### 2. Si Chat sigue vacio
- Verificar en consola del navegador si hay errores 401
- Verificar que `localStorage.getItem('authToken')` tiene valor despues del login
- Probar endpoint directamente:
```bash
curl -s "https://d.ateneo.co/backend/api/users/online-status" \
  -H "Authorization: Bearer [TOKEN]"
```

### 3. Si Tareas no carga
- Verificar que `/teams` retorna equipos
- Verificar que el equipo tiene tareas abiertas

### 4. Si Nueva Tarea falla
- Verificar que existen proyectos con `status = 'active'`
- Verificar que los proyectos tienen sprints no cerrados

---

## Historial de Builds

| Fecha | Build ID | Commit | Estado | Cambios |
|-------|----------|--------|--------|---------|
| 2025-12-01 23:51 | 4e01d1dc-... | c1a387c | EN COLA | Memory cache + fix interceptor 401 |
| 2025-12-01 21:55 | 002b4410-... | b03386e | PENDIENTE | Fix storage wrapper + commit git |
| 2025-12-01 21:45 | 27b5c295-... | 8cb3d5c | CANCELADO | Cambios no commiteados |
| 2025-12-01 19:03 | ad759840-... | 8cb3d5c | OK | Fix screens (sin storage wrapper) |
| 2025-12-01 18:43 | 4d87f0e7-... | 8cb3d5c | OK | Primer intento |
| 2025-12-01 18:21 | 0fad4ae7-... | 8cb3d5c | OK | URL /backend/api |
| 2025-12-01 18:07 | c875e87b-... | 8cb3d5c | OK | URL API corregida |

---

## Estructura del Proyecto

```
/var/www/d.ateneo.co/mobile-app/
├── App.js                 # Entry point
├── app.json               # Configuracion Expo
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
│       ├── storage.js        # Wrapper SecureStore/localStorage
│       └── socketService.js  # WebSocket para chat
└── DEVELOPMENT_LOG.md        # Este archivo
```

---

## Roadmap de Versiones

### Version 1.0 (Actual - Pendiente validacion)
- [x] Login/Autenticacion
- [x] Chat (contactos, conversaciones, proyectos, chat general)
- [x] Tareas (listado por equipo, filtros)
- [x] Crear tarea
- [x] Perfil
- [x] Compatibilidad web para debug
- [ ] **Pendiente:** Validar funcionamiento en APK

### Version 2.0 (Planificada)
- [ ] Llamadas de audio (WebRTC)
- [ ] Videollamadas
- [ ] Llamadas grupales
- [ ] Compartir pantalla (si es posible en mobile)
- [ ] Notificaciones push

**Referencia para llamadas (frontend web):**
- `/var/www/d.ateneo.co/frontend/src/services/callService.js` (~1000 lineas)
- `/var/www/d.ateneo.co/frontend/src/components/chat/CallModal.jsx`

---

## Notas Adicionales

- **App web funciona:** https://d.ateneo.co
- **Backend PHP:** `/var/www/d.ateneo.co/backend`
- **Frontend web React:** `/var/www/d.ateneo.co/frontend`
- **App movil:** `/var/www/d.ateneo.co/mobile-app`
- **Base de datos:** MySQL en AWS RDS (ver CREDENTIALS.txt)
- **Usuario de prueba:** streaming@ateneo.co / 1Aprende.4*
