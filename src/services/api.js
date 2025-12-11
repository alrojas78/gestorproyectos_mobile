import axios from 'axios';
import storage from './storage';
import debugLogger from './debugLogger';

const API_BASE_URL = 'https://d.ateneo.co/backend/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Interceptor para agregar el token JWT a todas las solicitudes
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItemAsync('authToken');
      debugLogger.api(`Interceptor - Token obtenido`, {
        hasToken: !!token,
        tokenLength: token?.length,
        url: config.url
      });

      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
        debugLogger.api(`Interceptor - Header Authorization agregado`);
      } else {
        debugLogger.api(`Interceptor - Sin token, request sin auth`);
      }
    } catch (error) {
      debugLogger.error(`Interceptor - Error obteniendo token`, { error: error.message });
    }
    return config;
  },
  (error) => {
    debugLogger.error(`Interceptor request error`, { error: error.message });
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
// NOTA: No borramos el token automáticamente en 401 porque puede causar
// problemas de timing. El logout explícito lo maneja AuthContext.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Solo logear el error, no borrar el token automáticamente
    if (error.response?.status === 401) {
      console.log('[API] Error 401 en:', error.config?.url);
    }
    return Promise.reject(error);
  }
);


// Helper para extraer datos de respuesta (maneja ambos formatos)
const extractData = (data, key = null) => {
  if (!data) return [];

  // Si es un array directo, devolverlo
  if (Array.isArray(data)) return data;

  // Si tiene success y una key específica
  if (data.success && key && data[key]) {
    return Array.isArray(data[key]) ? data[key] : data[key];
  }

  // Si tiene success y es un objeto con datos
  if (data.success) {
    // Buscar el primer array en el objeto
    for (const k of Object.keys(data)) {
      if (Array.isArray(data[k])) return data[k];
    }
  }

  // Si es un objeto simple (no error)
  if (!data.error && typeof data === 'object') {
    return data;
  }

  return [];
};

// Auth API
export const authApi = {
  login: async (email, password, rememberMe = false) => {
    const response = await api.post('/login', { email, password, remember_me: rememberMe });
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await api.get('/me');
    return response.data;
  },
};

// Tasks API
export const tasksApi = {
  getOpenTasksByTeam: async (teamId, date = null) => {
    const params = date ? { date } : {};
    const response = await api.get(`/teams/${teamId}/open-tasks`, { params });
    return extractData(response.data, 'tasks');
  },
  getWaitingTasks: async (filters = {}) => {
    const response = await api.get('/tasks/waiting', { params: filters });
    return extractData(response.data, 'tasks');
  },
  getBySprint: async (sprintId) => {
    const response = await api.get(`/sprints/${sprintId}/tasks`);
    return extractData(response.data, 'tasks');
  },
  create: async (sprintId, data) => {
    const response = await api.post(`/sprints/${sprintId}/tasks`, data);
    return response.data;
  },
  update: async (taskId, data) => {
    const response = await api.patch(`/tasks/${taskId}`, data);
    return response.data;
  },
  getOne: async (taskId) => {
    const response = await api.get(`/tasks/${taskId}`);
    return response.data;
  },
};

// Projects API
export const projectsApi = {
  getAll: async () => {
    const response = await api.get('/projects');
    return extractData(response.data, 'projects');
  },
  getOne: async (projectId) => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },
};

// Sprints API
export const sprintsApi = {
  getByProject: async (projectId) => {
    const response = await api.get(`/projects/${projectId}/sprints`);
    return extractData(response.data, 'sprints');
  },
  getOne: async (sprintId) => {
    const response = await api.get(`/sprints/${sprintId}`);
    return response.data;
  },
};

// Chat API
export const chatApi = {
  getConversations: async () => {
    const response = await api.get('/conversations');
    return extractData(response.data, 'conversations');
  },
  getMessages: async (conversationId, params = {}) => {
    const response = await api.get(`/conversations/${conversationId}/messages`, { params });
    return extractData(response.data, 'messages');
  },
  sendMessage: async (conversationId, content, messageType = 'text') => {
    const response = await api.post(`/conversations/${conversationId}/messages`, {
      content,
      message_type: messageType,
    });
    return response.data;
  },
  getOrCreateIndividual: async (userId) => {
    const response = await api.post('/conversations', { user_id: userId });
    // Este endpoint devuelve {success: true, conversation: {...}}
    if (response.data.success && response.data.conversation) {
      return response.data.conversation;
    }
    return response.data;
  },
  markAsRead: async (conversationId) => {
    const response = await api.put(`/conversations/${conversationId}/read`);
    return response.data;
  },
  getGeneralChat: async () => {
    const response = await api.get('/conversations/general');
    // Este endpoint devuelve {success: true, conversation: {...}}
    if (response.data.success && response.data.conversation) {
      return response.data.conversation;
    }
    return response.data;
  },
  getProjectConversation: async (projectId) => {
    const response = await api.get(`/projects/${projectId}/conversation`);
    if (response.data.success && response.data.conversation) {
      return response.data.conversation;
    }
    return response.data;
  },
};

// Users API
export const usersApi = {
  getAll: async () => {
    const response = await api.get('/users');
    return extractData(response.data, 'users');
  },
  getOnlineStatus: async () => {
    const response = await api.get('/users/online-status');
    // Este endpoint devuelve {success: true, users: [...]}
    return extractData(response.data, 'users');
  },
};

// Teams API
export const teamsApi = {
  getAll: async () => {
    const response = await api.get('/teams');
    return extractData(response.data, 'teams');
  },
  getOne: async (teamId) => {
    const response = await api.get(`/teams/${teamId}`);
    return response.data;
  },
  getMembers: async (teamId) => {
    const response = await api.get(`/teams/${teamId}/members`);
    return extractData(response.data, 'members');
  },
};

// Support API - Sistema de soporte al cliente
export const supportApi = {
  // Obtener sesiones de soporte
  getSessions: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.channelId) params.append('channel_id', filters.channelId);
    const response = await api.get(`/support/sessions?${params.toString()}`);
    return response.data;
  },

  // Obtener detalles de una sesión
  getSession: async (sessionId) => {
    const response = await api.get(`/support/sessions/${sessionId}`);
    return response.data;
  },

  // Obtener mensajes de una sesión
  getSessionMessages: async (sessionId) => {
    const response = await api.get(`/support/sessions/${sessionId}/messages`);
    return response.data;
  },

  // Enviar mensaje como agente
  sendMessage: async (sessionId, content, messageType = 'text') => {
    const response = await api.post(`/support/sessions/${sessionId}/messages`, {
      content,
      message_type: messageType
    });
    return response.data;
  },

  // Asignar sesión al agente actual
  assignSession: async (sessionId, agentId = null) => {
    const response = await api.post(`/support/sessions/${sessionId}/assign`, {
      agent_id: agentId
    });
    return response.data;
  },

  // Cerrar sesión
  closeSession: async (sessionId, resolution = null) => {
    const response = await api.post(`/support/sessions/${sessionId}/close`, {
      resolution
    });
    return response.data;
  },

  // Escalar sesión
  escalateSession: async (sessionId, data) => {
    const response = await api.post(`/support/sessions/${sessionId}/escalate`, data);
    return response.data;
  },

  // Marcar sesión como leída
  markSessionAsRead: async (sessionId) => {
    const response = await api.post(`/support/sessions/${sessionId}/read`);
    return response.data;
  },

  // Toggle IA para sesión
  toggleSessionAI: async (sessionId, enableAI) => {
    const response = await api.post(`/support/sessions/${sessionId}/toggle-ai`, {
      enable_ai: enableAI
    });
    return response.data;
  },

  // Obtener total de mensajes no leídos
  getUnreadTotal: async () => {
    const response = await api.get('/support/sessions/unread-total');
    return response.data;
  },

  // Obtener canales de soporte
  getChannels: async () => {
    const response = await api.get('/support/channels');
    return response.data;
  },
};

// Push Notifications API
export const pushApi = {
  // Registrar token de push notification
  registerToken: async (token, deviceInfo = {}) => {
    const response = await api.post('/push-token', {
      token,
      device_type: deviceInfo.device_type || 'android',
      device_name: deviceInfo.device_name || null,
      device_model: deviceInfo.device_model || null,
      os_version: deviceInfo.os_version || null,
      app_version: deviceInfo.app_version || null,
    });
    return response.data;
  },

  // Desactivar token (en logout)
  deactivateToken: async (token) => {
    const response = await api.delete('/push-token', {
      data: { token }
    });
    return response.data;
  },

  // Obtener tokens registrados del usuario (debug)
  getTokens: async () => {
    const response = await api.get('/push-tokens');
    return response.data;
  },
};

export default api;
