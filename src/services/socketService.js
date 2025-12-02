import { io } from 'socket.io-client';
import storage from './storage';
import debugLogger from './debugLogger';

const SOCKET_URL = 'https://d.ateneo.co';

class SocketService {
  socket = null;
  listeners = new Map();
  isConnecting = false;

  async connect() {
    if (this.socket?.connected || this.isConnecting) return;

    this.isConnecting = true;
    const token = await storage.getItemAsync('authToken');
    debugLogger.socket('Intentando conectar', { hasToken: !!token });
    if (!token) {
      this.isConnecting = false;
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      debugLogger.socket('Socket conectado');
      this.isConnecting = false;
    });

    this.socket.on('disconnect', () => {
      debugLogger.socket('Socket desconectado');
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
    if (this.socket?.connected) {
      this.socket.emit('join_conversation', { conversation_id: conversationId });
    }
  }

  leaveConversation(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('leave_conversation', { conversation_id: conversationId });
    }
  }

  sendMessage(conversationId, content, messageType = 'text') {
    if (this.socket?.connected) {
      this.socket.emit('send_message', {
        conversation_id: conversationId,
        content,
        message_type: messageType,
      });
    }
  }

  sendTyping(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('typing', { conversation_id: conversationId });
    }
  }

  markRead(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('mark_read', { conversation_id: conversationId });
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
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
