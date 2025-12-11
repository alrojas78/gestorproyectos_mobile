import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supportApi } from '../services/api';
import socketService from '../services/socketService';
import { useAuth } from '../context/AuthContext';

const SupportConversationScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { sessionId, customerName, status: initialStatus } = route.params;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(initialStatus);
  const [sessionData, setSessionData] = useState(null);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    loadMessages();
    loadSessionData();
    socketService.joinSupportSession(sessionId);

    // Marcar como leída
    supportApi.markSessionAsRead(sessionId).catch(console.error);

    const handleNewMessage = (data) => {
      if (String(data.sessionId) === String(sessionId) && data.message) {
        setMessages((prev) => {
          const exists = prev.some(m =>
            m.id === data.message.id ||
            (m.content === data.message.content && m.sender_type === data.message.sender_type && m.sending)
          );
          if (exists) {
            return prev.map(m =>
              (m.sending && m.content === data.message.content)
                ? data.message
                : m
            );
          }
          return [...prev, data.message];
        });
      }
    };

    const handleTyping = (data) => {
      if (String(data.sessionId) === String(sessionId) && data.userType === 'customer') {
        setIsTyping(data.isTyping);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        if (data.isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      }
    };

    const handleSessionClosed = (data) => {
      if (String(data.sessionId) === String(sessionId)) {
        setSessionStatus('closed');
      }
    };

    socketService.on('support_message', handleNewMessage);
    socketService.on('support_typing', handleTyping);
    socketService.on('session_closed', handleSessionClosed);

    return () => {
      socketService.leaveSupportSession(sessionId);
      socketService.off('support_message', handleNewMessage);
      socketService.off('support_typing', handleTyping);
      socketService.off('session_closed', handleSessionClosed);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      const response = await supportApi.getSession(sessionId);
      if (response.success && response.session) {
        setSessionData(response.session);
        setSessionStatus(response.session.status);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await supportApi.getSessionMessages(sessionId);
      const msgs = response.success ? response.messages : (Array.isArray(response) ? response : []);
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isSending || sessionStatus === 'closed') return;

    const messageText = inputText.trim();
    setInputText('');
    setIsSending(true);

    const tempMessage = {
      id: `temp_${Date.now()}`,
      content: messageText,
      sender_type: 'agent',
      sender_id: user?.id,
      sender_name: user?.name || 'Agente',
      created_at: new Date().toISOString(),
      sending: true,
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      if (socketService.isConnected()) {
        socketService.sendSupportMessage(sessionId, messageText);
      } else {
        const response = await supportApi.sendMessage(sessionId, messageText);
        if (response.success && response.message) {
          setMessages((prev) =>
            prev.map(msg => msg.id === tempMessage.id ? response.message : msg)
          );
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) =>
        prev.map(msg => msg.id === tempMessage.id ? { ...msg, sending: false, failed: true } : msg)
      );
      setInputText(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);
    socketService.sendSupportTyping(sessionId, true);
  };

  const handleAssignSession = async () => {
    try {
      const response = await supportApi.assignSession(sessionId);
      if (response.success) {
        setSessionStatus('assigned');
        Alert.alert('Exito', 'Sesion asignada correctamente');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo asignar la sesion');
    }
  };

  const handleCloseSession = async () => {
    Alert.alert(
      'Cerrar Sesion',
      '¿Estas seguro de cerrar esta sesion de soporte?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              socketService.closeSupportSession(sessionId);
              const response = await supportApi.closeSession(sessionId);
              if (response.success) {
                setSessionStatus('closed');
                Alert.alert('Exito', 'Sesion cerrada correctamente');
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo cerrar la sesion');
            }
          },
        },
      ]
    );
  };

  const handleEscalateSession = async () => {
    Alert.alert(
      'Escalar Sesion',
      '¿Deseas escalar esta sesion?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Escalar',
          onPress: async () => {
            try {
              const response = await supportApi.escalateSession(sessionId, {
                reason: 'Escalado desde app movil',
                priority: 'medium',
              });
              if (response.success) {
                setSessionStatus('escalated');
                Alert.alert('Exito', 'Sesion escalada correctamente');
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo escalar la sesion');
            }
          },
        },
      ]
    );
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const getSenderInfo = (item) => {
    switch (item.sender_type) {
      case 'customer':
        return { name: customerName || 'Cliente', color: '#f59e0b', icon: 'person' };
      case 'agent':
        return { name: item.sender_name || 'Agente', color: '#6366f1', icon: 'headset' };
      case 'ai':
        return { name: 'Asistente IA', color: '#a855f7', icon: 'sparkles' };
      case 'system':
        return { name: 'Sistema', color: '#6b7280', icon: 'information-circle' };
      default:
        return { name: 'Desconocido', color: '#6b7280', icon: 'help' };
    }
  };

  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.sender_type === 'agent' && item.sender_id === user?.id;
    const senderInfo = getSenderInfo(item);
    const showDate = index === 0 ||
      new Date(item.created_at).toDateString() !==
      new Date(messages[index - 1]?.created_at).toDateString();

    if (item.sender_type === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <>
        {showDate && (
          <View style={styles.dateDivider}>
            <Text style={styles.dateText}>
              {new Date(item.created_at).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
        )}
        <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
          {!isOwnMessage && (
            <View style={[styles.senderIcon, { backgroundColor: `${senderInfo.color}30` }]}>
              <Ionicons name={senderInfo.icon} size={16} color={senderInfo.color} />
            </View>
          )}
          <View style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
            item.sender_type === 'ai' && styles.aiMessage,
          ]}>
            {!isOwnMessage && (
              <Text style={[styles.senderName, { color: senderInfo.color }]}>{senderInfo.name}</Text>
            )}
            <Text style={styles.messageText}>{item.content}</Text>
            <View style={styles.messageFooter}>
              <Text style={styles.messageTime}>{formatMessageTime(item.created_at)}</Text>
              {item.sending && <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />}
              {item.failed && <Ionicons name="alert-circle" size={12} color="#ef4444" />}
            </View>
          </View>
        </View>
      </>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{customerName}</Text>
          <View style={styles.headerSubtitle}>
            {isTyping && <Text style={styles.typingText}>Escribiendo...</Text>}
            {!isTyping && sessionData?.external_email && (
              <Text style={styles.emailText} numberOfLines={1}>{sessionData.external_email}</Text>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          {sessionStatus === 'waiting' && (
            <TouchableOpacity onPress={handleAssignSession} style={styles.headerActionButton}>
              <Ionicons name="hand-right" size={20} color="#22c55e" />
            </TouchableOpacity>
          )}
          {sessionStatus !== 'closed' && (
            <>
              <TouchableOpacity onPress={handleEscalateSession} style={styles.headerActionButton}>
                <Ionicons name="arrow-up-circle" size={20} color="#f59e0b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCloseSession} style={styles.headerActionButton}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Session Info Bar */}
      {sessionData && (
        <View style={styles.sessionInfoBar}>
          <View style={styles.sessionInfoItem}>
            <Ionicons name="mail-outline" size={14} color="#6b7280" />
            <Text style={styles.sessionInfoText}>{sessionData.external_email || 'Sin email'}</Text>
          </View>
          {sessionData.external_phone && (
            <View style={styles.sessionInfoItem}>
              <Ionicons name="call-outline" size={14} color="#6b7280" />
              <Text style={styles.sessionInfoText}>{sessionData.external_phone}</Text>
            </View>
          )}
          <View style={styles.sessionInfoItem}>
            <Ionicons name="chatbubbles-outline" size={14} color="#6b7280" />
            <Text style={styles.sessionInfoText}>{messages.length} msgs</Text>
          </View>
        </View>
      )}

      {/* Closed Banner */}
      {sessionStatus === 'closed' && (
        <View style={styles.closedBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
          <Text style={styles.closedBannerText}>Sesion cerrada</Text>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id?.toString() || `msg-${Math.random()}`}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>Sin mensajes aun</Text>
          </View>
        }
      />

      {/* Input Area */}
      {sessionStatus !== 'closed' ? (
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#6b7280"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.closedInputArea}>
          <Text style={styles.closedInputText}>Esta sesion ha sido cerrada</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: { padding: 8, marginRight: 8 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  headerSubtitle: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  typingText: { fontSize: 12, color: '#22c55e' },
  emailText: { fontSize: 12, color: '#6b7280' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerActionButton: { padding: 8 },
  sessionInfoBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 16,
  },
  sessionInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionInfoText: { fontSize: 12, color: '#6b7280' },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    gap: 6,
  },
  closedBannerText: { color: '#22c55e', fontSize: 14, fontWeight: '500' },
  messagesList: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 1 },
  dateDivider: { alignItems: 'center', marginVertical: 16 },
  dateText: {
    color: '#6b7280',
    fontSize: 12,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: { marginVertical: 4, flexDirection: 'row', alignItems: 'flex-end' },
  ownMessageContainer: { justifyContent: 'flex-end' },
  senderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  messageBubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  ownMessage: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  otherMessage: { backgroundColor: '#1e293b', borderBottomLeftRadius: 4 },
  aiMessage: { backgroundColor: '#581c87', borderLeftWidth: 3, borderLeftColor: '#a855f7' },
  senderName: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  messageText: { color: '#fff', fontSize: 15, lineHeight: 20 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 6 },
  messageTime: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  systemMessageContainer: { alignItems: 'center', marginVertical: 8 },
  systemMessageText: { color: '#6b7280', fontSize: 12, fontStyle: 'italic' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 12 },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  input: { color: '#fff', fontSize: 15, maxHeight: 80 },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#4b5563' },
  closedInputArea: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'center',
  },
  closedInputText: { color: '#6b7280', fontSize: 14 },
});

export default SupportConversationScreen;
