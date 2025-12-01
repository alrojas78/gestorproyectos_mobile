import React, { createContext, useContext, useState, useEffect } from 'react';
import storage from '../services/storage';
import { authApi } from '../services/api';
import socketService from '../services/socketService';
import debugLogger from '../services/debugLogger';

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
    debugLogger.auth('checkAuth() iniciado');
    try {
      const token = await storage.getItemAsync('authToken');
      debugLogger.auth('Token recuperado', { hasToken: !!token, tokenLength: token?.length });

      if (token) {
        debugLogger.auth('Llamando API /me...');
        const userData = await authApi.getCurrentUser();
        debugLogger.auth('API /me OK', { userId: userData?.id, userName: userData?.name });
        setUser(userData);
        setIsAuthenticated(true);
        debugLogger.auth('Usuario autenticado, conectando socket...');
        await socketService.connect();
        debugLogger.auth('Socket conectado');
      } else {
        debugLogger.auth('No hay token guardado');
      }
    } catch (error) {
      debugLogger.error('checkAuth FALLO', { error: error.message, status: error.response?.status });
      await storage.deleteItemAsync('authToken');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
      debugLogger.auth('checkAuth() finalizado', { isAuthenticated });
    }
  };

  const login = async (email, password, rememberMe = false) => {
    debugLogger.auth('login() iniciado', { email });
    try {
      debugLogger.auth('Llamando API /login...');
      const response = await authApi.login(email, password, rememberMe);
      debugLogger.auth('API /login respuesta', { hasToken: !!response.token, hasUser: !!response.user });

      if (response.token) {
        debugLogger.auth('Guardando token...');
        const saved = await storage.setItemAsync('authToken', response.token);
        debugLogger.auth('Token guardado', { success: saved, tokenLength: response.token.length });

        // Verificar que se guardo correctamente
        const verifyToken = await storage.getItemAsync('authToken');
        debugLogger.auth('Verificacion token guardado', { recuperado: !!verifyToken, coincide: verifyToken === response.token });

        setUser(response.user);
        setIsAuthenticated(true);
        debugLogger.auth('Conectando socket...');
        await socketService.connect();
        debugLogger.auth('Login completado exitosamente');
        return { success: true };
      }
      debugLogger.error('Login sin token en respuesta');
      return { success: false, error: 'No se recibio token' };
    } catch (error) {
      debugLogger.error('login FALLO', { error: error.message, status: error.response?.status });
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
