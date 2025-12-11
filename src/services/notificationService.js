import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import debugLogger from './debugLogger';

// Configurar como se muestran las notificaciones cuando la app esta en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.onNotificationReceived = null;
    this.onNotificationResponse = null;
  }

  // Registrar para notificaciones push y obtener token
  async registerForPushNotifications() {
    debugLogger.log('[NOTIFICATIONS] Iniciando registro para push notifications...');

    let token = null;

    // Verificar si es un dispositivo fisico
    if (!Device.isDevice) {
      debugLogger.log('[NOTIFICATIONS] No es dispositivo fisico, push notifications no disponibles en emulador');
      return null;
    }

    // Verificar/solicitar permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    debugLogger.log('[NOTIFICATIONS] Estado de permisos actual:', existingStatus);

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      debugLogger.log('[NOTIFICATIONS] Solicitando permisos...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      debugLogger.log('[NOTIFICATIONS] Permisos denegados');
      return null;
    }

    debugLogger.log('[NOTIFICATIONS] Permisos concedidos, obteniendo token...');

    try {
      // Obtener el projectId de la configuracion de Expo
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        debugLogger.error('[NOTIFICATIONS] No se encontro projectId en la configuracion');
        return null;
      }

      // Obtener Expo Push Token
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      token = tokenResponse.data;
      this.expoPushToken = token;
      debugLogger.log('[NOTIFICATIONS] Token obtenido:', token);

    } catch (error) {
      debugLogger.error('[NOTIFICATIONS] Error obteniendo token:', error.message);
      return null;
    }

    // Configurar canal de notificaciones para Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
        sound: 'default',
      });

      // Canal especifico para mensajes de chat
      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Mensajes de chat',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
        sound: 'default',
      });

      // Canal para tareas
      await Notifications.setNotificationChannelAsync('tasks', {
        name: 'Notificaciones de tareas',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#10b981',
        sound: 'default',
      });

      // Canal para soporte
      await Notifications.setNotificationChannelAsync('support', {
        name: 'Soporte al cliente',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f59e0b',
        sound: 'default',
      });

      debugLogger.log('[NOTIFICATIONS] Canales de Android configurados');
    }

    return token;
  }

  // Configurar listeners para notificaciones
  setupNotificationListeners(onReceived, onResponse) {
    debugLogger.log('[NOTIFICATIONS] Configurando listeners...');

    this.onNotificationReceived = onReceived;
    this.onNotificationResponse = onResponse;

    // Listener para notificaciones recibidas mientras la app esta abierta
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      debugLogger.log('[NOTIFICATIONS] Notificacion recibida:', notification.request.content);
      if (this.onNotificationReceived) {
        this.onNotificationReceived(notification);
      }
    });

    // Listener para cuando el usuario toca la notificacion
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      debugLogger.log('[NOTIFICATIONS] Usuario toco notificacion:', response.notification.request.content);
      if (this.onNotificationResponse) {
        this.onNotificationResponse(response);
      }
    });

    debugLogger.log('[NOTIFICATIONS] Listeners configurados');
  }

  // Remover listeners
  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
    debugLogger.log('[NOTIFICATIONS] Listeners removidos');
  }

  // Obtener el token actual
  getToken() {
    return this.expoPushToken;
  }

  // Limpiar badge de notificaciones
  async clearBadge() {
    await Notifications.setBadgeCountAsync(0);
  }

  // Establecer badge count
  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }

  // Programar notificacion local (para pruebas)
  async scheduleLocalNotification(title, body, data = {}, channelId = 'default') {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: null, // Inmediata
    });
  }

  // Cancelar todas las notificaciones programadas
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Obtener informacion del dispositivo para el registro
  getDeviceInfo() {
    return {
      brand: Device.brand,
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      deviceType: Device.deviceType,
      isDevice: Device.isDevice,
    };
  }
}

const notificationService = new NotificationService();
export default notificationService;
