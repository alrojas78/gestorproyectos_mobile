import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Wrapper para almacenamiento que funciona en web y mobile
const storage = {
  async getItemAsync(key) {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.error('[Storage] Error getting item from localStorage:', e);
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error('[Storage] Error getting item from SecureStore:', e);
      return null;
    }
  },

  async setItemAsync(key, value) {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.error('[Storage] Error setting item in localStorage:', e);
        return false;
      }
    }
    try {
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (e) {
      console.error('[Storage] Error setting item in SecureStore:', e);
      return false;
    }
  },

  async deleteItemAsync(key) {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        console.error('[Storage] Error deleting item from localStorage:', e);
        return false;
      }
    }
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (e) {
      console.error('[Storage] Error deleting item from SecureStore:', e);
      return false;
    }
  }
};

export default storage;
