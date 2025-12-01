# Informe de Seguimiento - App Movil Gestion de Proyectos

## Fecha: 2025-12-01

---

## Estado Actual: BUILD EN PROCESO

**Build ID:** ad759840-1f9f-47e8-9c2b-25c7be855c38
**URL:** https://expo.dev/accounts/alrojas78/projects/sprints-diarios/builds/ad759840-1f9f-47e8-9c2b-25c7be855c38

---

## Problema Original

La app movil en React Native/Expo no funcionaba correctamente despues del login:
- Chat mostraba "No hay contactos"
- Tareas se quedaba cargando infinitamente
- Nueva Tarea mostraba "No se pudieron cargar los datos"
- Solo funcionaba el formulario de login y el perfil

**Causa raiz:** Inconsistencia entre el formato de respuesta de la API del backend y lo que esperaba la app movil.

---

## Cambios Realizados

### 1. api.js (Servicio de API)
**Archivo:** `/var/www/d.ateneo.co/mobile-app/src/services/api.js`

- Cambiado `API_BASE_URL` de `/api` a `/backend/api`
- Agregada funcion `extractData()` para manejar ambos formatos de respuesta:
  - Arrays directos: `[{...}, {...}]`
  - Objetos con success: `{success: true, conversations: [...]}`
- Agregado timeout de 30 segundos
- Agregados endpoints: `getProjectConversation`, `getMembers`

### 2. ChatListScreen.js
**Archivo:** `/var/www/d.ateneo.co/mobile-app/src/screens/ChatListScreen.js`

- Reescrito completamente
- Implementados 3 tabs: Contactos, Recientes, Proyectos
- Chat General visible al inicio (si existe)
- Carga usuarios desde `/users/online-status`
- Ordenamiento: usuarios online primero
- Manejo de errores con boton "Reintentar"

### 3. TasksListScreen.js
**Archivo:** `/var/www/d.ateneo.co/mobile-app/src/screens/TasksListScreen.js`

- Reescrito completamente
- Selector de equipos horizontal (carga desde `/teams`)
- Selecciona automaticamente el equipo del usuario o el primero disponible
- Carga tareas del equipo seleccionado desde `/teams/{id}/open-tasks`
- Filtros: Todas, Mis Tareas, Pendientes
- Manejo de errores robusto

### 4. CreateTaskScreen.js
**Archivo:** `/var/www/d.ateneo.co/mobile-app/src/screens/CreateTaskScreen.js`

- Corregida carga de datos inicial
- Carga proyectos desde `/projects`
- Carga usuarios desde `/teams/{id}/members` (con fallback)
- Filtrado de proyectos activos
- Mensaje de error visible con opcion de reintentar

### 5. app.json
**Archivo:** `/var/www/d.ateneo.co/mobile-app/app.json`

- Nombre cambiado de "Sprints Diarios" a "Gestion de Proyectos"

---

## Endpoints del Backend Utilizados

| Endpoint | Formato Respuesta | Usado en |
|----------|------------------|----------|
| POST /login | `{token, user}` | AuthContext |
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

# Ver logs de un build
eas build:view [BUILD_ID]
```

---

## Proximos Pasos (Si Persisten Errores)

1. **Si Chat sigue vacio:**
   - Verificar que el usuario tenga permisos para ver `/users/online-status`
   - El endpoint requiere autenticacion, verificar que el token se envia correctamente

2. **Si Tareas no carga:**
   - Verificar que existan equipos en la BD (`/teams` debe retornar al menos 1)
   - Verificar que el equipo tenga tareas abiertas

3. **Si Nueva Tarea falla:**
   - Verificar que existan proyectos activos (`status = 'active'`)
   - Verificar que los proyectos tengan sprints no cerrados

4. **Debug en dispositivo:**
   - Conectar con `npx expo start` y usar React Native Debugger
   - Ver logs de consola para errores especificos

---

## Historial de Builds

| Fecha | Build ID | Estado | Cambios |
|-------|----------|--------|---------|
| 2025-12-01 | c875e87b-... | OK | URL API corregida |
| 2025-12-01 | 0fad4ae7-... | OK | URL /backend/api |
| 2025-12-01 | 4d87f0e7-... | OK | Primer intento de fix |
| 2025-12-01 | ad759840-... | EN PROCESO | Fix completo de screens |

---

## Roadmap de Versiones

### Version 1.0 (Actual - En testing)
- [x] Login/Autenticacion
- [x] Chat (contactos, conversaciones, proyectos, chat general)
- [x] Tareas (listado por equipo, filtros)
- [x] Crear tarea
- [x] Perfil
- [ ] Pendiente validar funcionamiento completo

### Version 2.0 (Planificada)
- [ ] Llamadas de audio (WebRTC)
- [ ] Videollamadas
- [ ] Llamadas grupales
- [ ] Compartir pantalla (si es posible en mobile)

**Nota:** El frontend web ya tiene llamadas implementadas en:
- `/var/www/d.ateneo.co/frontend/src/services/callService.js` (~1000 lineas)
- `/var/www/d.ateneo.co/frontend/src/components/chat/CallModal.jsx`

Para la app movil se requiere:
- Instalar `react-native-webrtc`
- Crear `src/services/callService.js` (adaptar del web)
- Crear `src/screens/CallScreen.js`
- Agregar permisos CAMERA y RECORD_AUDIO

---

## Notas Adicionales

- La app web funciona correctamente en https://d.ateneo.co
- El backend PHP esta en `/var/www/d.ateneo.co/backend`
- El frontend web React esta en `/var/www/d.ateneo.co/frontend`
- La app movil esta en `/var/www/d.ateneo.co/mobile-app`
- Base de datos: MySQL en AWS RDS (ver CREDENTIALS.txt)
