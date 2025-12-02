import { io } from 'socket.io-client';
import storage from './storage';
import debugLogger from './debugLogger';

const SOCKET_URL = 'https://d.ateneo.co:3001';

class SocketService {
  socket = null;
  listeners = new Map();
  isConnecting = false;
  pendingListeners = []; // Listeners que se registran antes de conectar
  pendingEmits = []; // Emits pendientes (ej: join_conversation)

  async connect() {
    if (this.socket?.connected || this.isConnecting) return;

    this.isConnecting = true;
    const token = await storage.getItemAsync('authToken');
    debugLogger.socket('Intentando conectar WebSocket', { hasToken: !!token, url: SOCKET_URL });
    if (!token) {
      this.isConnecting = false;
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      debugLogger.socket('Socket conectado', { id: this.socket.id });
      this.isConnecting = false;

      // 1. Registrar listeners pendientes
      this.pendingListeners.forEach(({ event, callback }) => {
        this.socket.on(event, callback);
      });
      this.pendingListeners = [];

      // 2. Ejecutar emits pendientes (ej: join_conversation)
      this.pendingEmits.forEach(({ event, data }) => {
        this.socket.emit(event, data);
        debugLogger.socket('Emit pendiente ejecutado', { event, data });
      });
      this.pendingEmits = [];
    });

    this.socket.on('disconnect', (reason) => {
      debugLogger.socket('Socket desconectado', { reason });
    });

    this.socket.on('connect_error', (error) => {
      debugLogger.error('Socket connection error', { error: error.message });
      this.isConnecting = false;
    });
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinConversation(conversationId) {
    const data = { conversationId };
    if (this.socket?.connected) {
      this.socket.emit('join_conversation', data);
      debugLogger.socket('join_conversation emitido', data);
    } else {
      // Guardar para ejecutar cuando se conecte
      this.pendingEmits.push({ event: 'join_conversation', data });
      debugLogger.socket('join_conversation guardado en pendientes', data);
      // Intentar conectar si no está conectando
      if (!this.isConnecting) {
        this.connect();
      }
    }
  }

  leaveConversation(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('leave_conversation', { conversationId });
    }
  }

  sendMessage(conversationId, content, messageType = 'text') {
    const data = { conversationId, content, messageType };
    if (this.socket?.connected) {
      this.socket.emit('send_message', data);
      debugLogger.socket('send_message emitido', { conversationId, content: content.substring(0, 20) });
    } else {
      // Guardar para ejecutar cuando se conecte
      this.pendingEmits.push({ event: 'send_message', data });
      debugLogger.socket('send_message guardado en pendientes', { conversationId });
      if (!this.isConnecting) {
        this.connect();
      }
    }
  }

  sendTyping(conversationId, isTyping = true) {
    if (this.socket?.connected) {
      this.socket.emit('typing', { conversationId, isTyping });
    }
  }

  markRead(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('mark_read', { conversationId });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    if (this.socket?.connected) {
      this.socket.on(event, callback);
    } else {
      // Guardar para registrar cuando se conecte
      this.pendingListeners.push({ event, callback });
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
    // Remover de listeners pendientes
    this.pendingListeners = this.pendingListeners.filter(
      (l) => !(l.event === event && l.callback === callback)
    );
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach((callback) => {
          this.socket.off(event, callback);
        });
      });
      this.listeners.clear();
    }
  }
}

export default new SocketService();
