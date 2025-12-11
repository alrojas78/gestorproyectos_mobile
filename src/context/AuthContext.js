import React, { createContext, useContext, useState, useEffect } from 'react';
import storage from '../services/storage';
import { authApi, pushApi } from '../services/api';
import socketService from '../services/socketService';
import debugLogger from '../services/debugLogger';
import notificationService from '../services/notificationService';

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
  const [pushToken, setPushToken] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Registrar push token cuando el usuario se autentica
  const registerPushToken = async () => {
    try {
      debugLogger.log('[AUTH] Iniciando registro de push token...');
      const token = await notificationService.registerForPushNotifications();

      if (token) {
        setPushToken(token);
        debugLogger.log('[AUTH] Push token obtenido:', token);

        // Obtener info del dispositivo
        const deviceInfo = notificationService.getDeviceInfo();

        // Registrar en el servidor
        const result = await pushApi.registerToken(token, {
          device_type: deviceInfo.osName?.toLowerCase() === 'ios' ? 'ios' : 'android',
          device_name: deviceInfo.brand,
          device_model: deviceInfo.modelName,
          os_version: deviceInfo.osVersion,
          app_version: '1.0.10',
        });

        debugLogger.log('[AUTH] Push token registrado en servidor:', result);
        // Debug alert - remover en produccion
        alert('Push token registrado: ' + token.substring(0, 30) + '...');
      } else {
        debugLogger.log('[AUTH] No se pudo obtener push token (emulador o permisos denegados)');
        alert('No se pudo obtener push token');
      }
    } catch (error) {
      debugLogger.error('[AUTH] Error registrando push token:', error.message);
      alert('Error registrando push: ' + error.message);
    }
  };

  // Desactivar push token al cerrar sesion
  const deactivatePushToken = async () => {
    if (pushToken) {
      try {
        await pushApi.deactivateToken(pushToken);
        debugLogger.log('[AUTH] Push token desactivado');
      } catch (error) {
        debugLogger.error('[AUTH] Error desactivando push token:', error.message);
      }
    }
    setPushToken(null);
  };

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

        // Registrar push token despues de autenticacion exitosa
        registerPushToken();
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
        debugLogger.auth('Socket conectado');

        // Registrar push token despues de login exitoso
        registerPushToken();

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
    // Desactivar push token antes de cerrar sesion
    await deactivatePushToken();

    // Remover listeners de notificaciones
    notificationService.removeNotificationListeners();

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
