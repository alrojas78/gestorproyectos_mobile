import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatApi } from '../services/api';
import socketService from '../services/socketService';
import { useAuth } from '../context/AuthContext';

const ChatConversationScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { conversationId, name } = route.params;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    loadMessages();
    socketService.joinConversation(conversationId);

    // El servidor emite el mensaje completo con conversationId incluido
    const handleNewMessage = (message) => {
      // El servidor envía: { ...messageData, conversationId }
      const msgConversationId = message.conversationId || message.conversation_id;

      if (String(msgConversationId) === String(conversationId)) {
        // Evitar duplicados (por si ya lo agregamos como mensaje temporal)
        setMessages((prev) => {
          const exists = prev.some(m =>
            m.id === message.id ||
            (m.content === message.content && m.sender_id === message.sender_id && m.sending)
          );
          if (exists) {
            // Reemplazar mensaje temporal con el real
            return prev.map(m =>
              (m.sending && m.content === message.content && m.sender_id === message.sender_id)
                ? message
                : m
            );
          }
          return [...prev, message];
        });
        socketService.markRead(conversationId);
      }
    };

    const handleTyping = (data) => {
      const typingConversationId = data.conversationId || data.conversation_id;
      const typingUserId = data.userId || data.user_id;

      if (String(typingConversationId) === String(conversationId) && typingUserId !== user?.id) {
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    };

    socketService.on('new_message', handleNewMessage);
    socketService.on('typing', handleTyping);

    return () => {
      socketService.leaveConversation(conversationId);
      socketService.off('new_message', handleNewMessage);
      socketService.off('typing', handleTyping);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, user?.id]);

  const loadMessages = async () => {
    try {
      const data = await chatApi.getMessages(conversationId, { limit: 50 });
      // El backend ya devuelve los mensajes en orden cronológico (más antiguo primero)
      setMessages(Array.isArray(data) ? data : []);
      chatApi.markAsRead(conversationId);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isSending) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Crear mensaje temporal para mostrar inmediatamente
    const tempMessage = {
      id: `temp_${Date.now()}`,
      content: messageText,
      sender_id: user?.id,
      sender_name: user?.name || 'Yo',
      created_at: new Date().toISOString(),
      sending: true,
    };

    // Agregar mensaje temporal a la lista
    setMessages((prev) => [...prev, tempMessage]);

    try {
      // Usar API REST para enviar (más confiable que WebSocket)
      const response = await chatApi.sendMessage(conversationId, messageText);

      // Reemplazar mensaje temporal con el real
      if (response.success && response.message) {
        setMessages((prev) =>
          prev.map(msg =>
            msg.id === tempMessage.id ? response.message : msg
          )
        );
      }

      // También notificar via WebSocket si está conectado
      if (socketService.isConnected()) {
        socketService.sendMessage(conversationId, messageText);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Marcar mensaje como fallido
      setMessages((prev) =>
        prev.map(msg =>
          msg.id === tempMessage.id ? { ...msg, sending: false, failed: true } : msg
        )
      );
      setInputText(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);
    socketService.sendTyping(conversationId);
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const showDate = index === 0 ||
      new Date(item.created_at).toDateString() !==
      new Date(messages[index - 1]?.created_at).toDateString();

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
          <View style={[styles.messageBubble, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
            {!isOwnMessage && (
              <Text style={styles.senderName}>{item.sender_name}</Text>
            )}
            <Text style={styles.messageText}>{item.content}</Text>
            <Text style={styles.messageTime}>{formatMessageTime(item.created_at)}</Text>
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
          <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
          {isTyping && <Text style={styles.typingText}>Escribiendo...</Text>}
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>Inicia la conversacion</Text>
          </View>
        }
      />

      {/* Input Area */}
      <View style={styles.inputArea}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="attach" size={24} color="#6b7280" />
        </TouchableOpacity>
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  typingText: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 2,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexGrow: 1,
  },
  dateDivider: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    color: '#6b7280',
    fontSize: 12,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  ownMessage: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
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
  input: {
    color: '#fff',
    fontSize: 15,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#4b5563',
  },
});

export default ChatConversationScreen;
