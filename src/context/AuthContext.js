import React, { createContext, useContext, useState, useEffect } from 'react';
import storage from '../services/storage';
import { authApi } from '../services/api';
import socketService from '../services/socketService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await storage.getItemAsync('authToken');
      if (token) {
        const userData = await authApi.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
        await socketService.connect();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await storage.deleteItemAsync('authToken');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await authApi.login(email, password, rememberMe);
      if (response.token) {
        await storage.setItemAsync('authToken', response.token);
        setUser(response.user);
        setIsAuthenticated(true);
        await socketService.connect();
        return { success: true };
      }
      return { success: false, error: 'No se recibio token' };
    } catch (error) {
      const message = error.response?.data?.error || 'Error al iniciar sesion';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    socketService.disconnect();
    await storage.deleteItemAsync('authToken');
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
