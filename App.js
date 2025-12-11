import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import notificationService from './src/services/notificationService';

export default function App() {
  const navigationRef = useRef(null);

  useEffect(() => {
    // Configurar listeners de notificaciones
    notificationService.setupNotificationListeners(
      // Notificacion recibida en primer plano
      (notification) => {
        console.log('[APP] Notificacion recibida:', notification.request.content);
      },
      // Usuario toco la notificacion
      (response) => {
        const data = response.notification.request.content.data;
        console.log('[APP] Notificacion tocada, data:', data);

        // Navegar segun el tipo de notificacion
        if (data?.type === 'chat_message' && data.conversationId) {
          // Navegar a la conversacion
          if (navigationRef.current) {
            navigationRef.current.navigate('ChatConversation', {
              conversationId: data.conversationId
            });
          }
        } else if (data?.type === 'support_message' && data.sessionId) {
          // Navegar a soporte
          if (navigationRef.current) {
            navigationRef.current.navigate('SupportConversation', {
              sessionId: data.sessionId
            });
          }
        }
      }
    );

    // Limpiar badge al abrir la app
    notificationService.clearBadge();

    return () => {
      notificationService.removeNotificationListeners();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator navigationRef={navigationRef} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
