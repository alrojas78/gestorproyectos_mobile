import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import debugLogger from './debugLogger';

// Wrapper para almacenamiento que funciona en web y mobile
const storage = {
  async getItemAsync(key) {
    debugLogger.storage(`getItemAsync(${key}) - Platform: ${Platform.OS}`);

    if (Platform.OS === 'web') {
      try {
        const value = localStorage.getItem(key);
        debugLogger.storage(`localStorage.getItem OK`, { key, hasValue: !!value, length: value?.length });
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
      debugLogger.storage(`SecureStore.getItemAsync OK`, { key, hasValue: !!value, length: value?.length });
      return value;
    } catch (e) {
      debugLogger.error(`SecureStore.getItemAsync FALLO`, { key, error: e.message });
      return null;
    }
  },

  async setItemAsync(key, value) {
    debugLogger.storage(`setItemAsync(${key}) - Platform: ${Platform.OS}`, { valueLength: value?.length });

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

    // Mobile - usar SecureStore
    try {
      debugLogger.storage(`Llamando SecureStore.setItemAsync...`);
      await SecureStore.setItemAsync(key, value);
      debugLogger.storage(`SecureStore.setItemAsync OK`, { key });
      return true;
    } catch (e) {
      debugLogger.error(`SecureStore.setItemAsync FALLO`, { key, error: e.message });
      return false;
    }
  },

  async deleteItemAsync(key) {
    debugLogger.storage(`deleteItemAsync(${key}) - Platform: ${Platform.OS}`);

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
      return false;
    }
  }
};

export default storage;
