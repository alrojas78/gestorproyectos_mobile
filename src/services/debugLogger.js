// Debug Logger - Muestra logs en pantalla para diagnostico en movil
import { Platform } from 'react-native';

class DebugLogger {
  constructor() {
    this.logs = [];
    this.listeners = [];
    this.maxLogs = 50;
  }

  log(category, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const logEntry = {
      id: Date.now(),
      timestamp,
      category,
      message,
      data: data ? JSON.stringify(data).substring(0, 100) : null,
      platform: Platform.OS
    };

    this.logs.unshift(logEntry);

    // Mantener solo los ultimos N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notificar a los listeners
    this.listeners.forEach(listener => listener(this.logs));

    // Tambien imprimir en consola
    console.log(`[${category}] ${message}`, data || '');
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener(this.logs));
  }

  // Helpers para categorias comunes
  auth(message, data = null) {
    this.log('AUTH', message, data);
  }

  storage(message, data = null) {
    this.log('STORAGE', message, data);
  }

  api(message, data = null) {
    this.log('API', message, data);
  }

  socket(message, data = null) {
    this.log('SOCKET', message, data);
  }

  error(message, data = null) {
    this.log('ERROR', message, data);
  }
}

export default new DebugLogger();
