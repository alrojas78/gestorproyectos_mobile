import axios from 'axios';
import storage from './storage';

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
    const token = await storage.getItemAsync('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
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

export default api;
