import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import debugLogger from './debugLogger';

// Cache en memoria para evitar problemas de timing con SecureStore
const memoryCache = {};

// Wrapper para almacenamiento que funciona en web y mobile
// Usa cache en memoria + SecureStore para máxima confiabilidad
const storage = {
  async getItemAsync(key) {
    debugLogger.storage(`getItemAsync(${key}) - Platform: ${Platform.OS}`);

    // Primero verificar cache en memoria (más rápido y confiable)
    if (memoryCache[key] !== undefined) {
      debugLogger.storage(`Cache en memoria HIT`, { key, hasValue: !!memoryCache[key] });
      return memoryCache[key];
    }

    if (Platform.OS === 'web') {
      try {
        const value = localStorage.getItem(key);
        debugLogger.storage(`localStorage.getItem OK`, { key, hasValue: !!value });
        if (value) {
          memoryCache[key] = value; // Guardar en cache
        }
        return value;
      } catch (e) {
        debugLogger.error(`localStorage.getItem FALLO`, { key, error: e.message });
        return null;
      }
    }

    // Mobile - usar SecureStore
    try {
      debugLogger.storage(`Llamando SecureStore.getItemAsync...`);
      const value = await SecureStore.getItemAsync(key);
      debugLogger.storage(`SecureStore.getItemAsync OK`, { key, hasValue: !!value });
      if (value) {
        memoryCache[key] = value; // Guardar en cache
      }
      return value;
    } catch (e) {
      debugLogger.error(`SecureStore.getItemAsync FALLO`, { key, error: e.message });
      return null;
    }
  },

  async setItemAsync(key, value) {
    debugLogger.storage(`setItemAsync(${key}) - Platform: ${Platform.OS}`, { valueLength: value?.length });

    // Guardar inmediatamente en memoria para acceso instantáneo
    memoryCache[key] = value;
    debugLogger.storage(`Cache en memoria SET`, { key });

    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
        debugLogger.storage(`localStorage.setItem OK`, { key });
        return true;
      } catch (e) {
        debugLogger.error(`localStorage.setItem FALLO`, { key, error: e.message });
        return false;
      }
    }

    // Mobile - usar SecureStore (async, pero ya tenemos en memoria)
    try {
      debugLogger.storage(`Llamando SecureStore.setItemAsync...`);
      await SecureStore.setItemAsync(key, value);
      debugLogger.storage(`SecureStore.setItemAsync OK`, { key });
      return true;
    } catch (e) {
      debugLogger.error(`SecureStore.setItemAsync FALLO`, { key, error: e.message });
      // Aunque falle SecureStore, el valor está en memoria
      return true; // Retornamos true porque está en memoria
    }
  },

  async deleteItemAsync(key) {
    debugLogger.storage(`deleteItemAsync(${key}) - Platform: ${Platform.OS}`);

    // Eliminar de memoria inmediatamente
    delete memoryCache[key];
    debugLogger.storage(`Cache en memoria DELETE`, { key });

    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
        debugLogger.storage(`localStorage.removeItem OK`, { key });
        return true;
      } catch (e) {
        debugLogger.error(`localStorage.removeItem FALLO`, { key, error: e.message });
        return false;
      }
    }

    // Mobile - usar SecureStore
    try {
      await SecureStore.deleteItemAsync(key);
      debugLogger.storage(`SecureStore.deleteItemAsync OK`, { key });
      return true;
    } catch (e) {
      debugLogger.error(`SecureStore.deleteItemAsync FALLO`, { key, error: e.message });
      return true; // Ya se eliminó de memoria
    }
  }
};

export default storage;
