import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatApi, usersApi, projectsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ChatListScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [generalChat, setGeneralChat] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('contacts');
  const [error, setError] = useState(null);

  const loadData = async () => {
    setError(null);
    try {
      // Cargar usuarios con estado online
      try {
        const usersData = await usersApi.getOnlineStatus();
        if (Array.isArray(usersData)) {
          setUsers(usersData.filter(u => u.id !== user?.id));
          const statusMap = {};
          usersData.forEach((u) => {
            statusMap[u.id] = u.is_online === 1 || u.is_online === '1' || u.is_online === true;
          });
          setOnlineStatus(statusMap);
        }
      } catch (e) {
        console.error('Error cargando usuarios:', e.message);
      }

      // Cargar conversaciones
      try {
        const convData = await chatApi.getConversations();
        if (Array.isArray(convData)) {
          setConversations(convData);
        }
      } catch (e) {
        console.error('Error cargando conversaciones:', e.message);
      }

      // Cargar proyectos
      try {
        const projectsData = await projectsApi.getAll();
        if (Array.isArray(projectsData)) {
          setProjects(projectsData);
        }
      } catch (e) {
        console.error('Error cargando proyectos:', e.message);
      }

      // Cargar chat general
      try {
        const generalData = await chatApi.getGeneralChat();
        if (generalData && generalData.id) {
          setGeneralChat(generalData);
        }
      } catch (e) {
        console.error('Error chat general:', e.message);
      }
    } catch (error) {
      console.error('Error general en loadData:', error.message);
      setError('Error al cargar datos');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user?.id])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Ayer';
    }
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  };

  const handleUserClick = async (selectedUser) => {
    try {
      const conversation = await chatApi.getOrCreateIndividual(selectedUser.id);
      if (conversation && conversation.id) {
        navigation.navigate('ChatConversation', {
          conversationId: conversation.id,
          name: selectedUser.name,
        });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleConversationClick = (conv) => {
    navigation.navigate('ChatConversation', {
      conversationId: conv.id,
      name: conv.display_name || conv.name || 'Chat',
    });
  };

  const handleProjectClick = async (project) => {
    try {
      const conversation = await chatApi.getProjectConversation(project.id);
      if (conversation && conversation.id) {
        navigation.navigate('ChatConversation', {
          conversationId: conversation.id,
          name: project.name,
        });
      }
    } catch (error) {
      console.error('Error opening project chat:', error);
    }
  };

  const handleGeneralChatClick = () => {
    if (generalChat) {
      navigation.navigate('ChatConversation', {
        conversationId: generalChat.id,
        name: 'Chat General',
      });
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const aOnline = onlineStatus[a.id] ? 1 : 0;
    const bOnline = onlineStatus[b.id] ? 1 : 0;
    return bOnline - aOnline;
  });

  const renderUserItem = ({ item }) => {
    const isOnline = onlineStatus[item.id];

    return (
      <TouchableOpacity style={styles.listItem} onPress={() => handleUserClick(item)}>
        <View style={styles.avatarContainer}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {item.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.onlineIndicator, isOnline && styles.online]} />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemStatus}>
            {isOnline ? 'En linea' : 'Desconectado'}
          </Text>
        </View>
        <Ionicons name="chatbubble-outline" size={20} color="#6366f1" />
      </TouchableOpacity>
    );
  };

  const renderConversationItem = ({ item }) => {
    const name = item.display_name || item.name || 'Chat';
    const unreadCount = parseInt(item.unread_count) || 0;
    const isGroup = item.type === 'group' || item.type === 'project';

    return (
      <TouchableOpacity style={styles.listItem} onPress={() => handleConversationClick(item)}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name={isGroup ? 'people' : 'person'} size={24} color="#6366f1" />
          </View>
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
            <Text style={styles.itemTime}>{formatTime(item.last_message_at)}</Text>
          </View>
          <View style={styles.itemFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.last_message || 'Sin mensajes'}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProjectItem = ({ item }) => (
    <TouchableOpacity style={styles.listItem} onPress={() => handleProjectClick(item)}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, styles.avatarPlaceholder, styles.projectAvatar]}>
          <Ionicons name="folder" size={24} color="#22c55e" />
        </View>
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemStatus}>Chat de proyecto</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  const TabButton = ({ value, label, icon, count }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === value && styles.tabButtonActive]}
      onPress={() => setActiveTab(value)}
    >
      <Ionicons name={icon} size={18} color={activeTab === value ? '#fff' : '#9ca3af'} />
      <Text style={[styles.tabText, activeTab === value && styles.tabTextActive]}>{label}</Text>
      {count > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const totalUnread = conversations.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      {generalChat && (
        <TouchableOpacity style={styles.generalChat} onPress={handleGeneralChatClick}>
          <View style={[styles.avatar, styles.avatarPlaceholder, styles.generalChatAvatar]}>
            <Ionicons name="globe" size={24} color="#fff" />
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.itemName}>Chat General</Text>
            <Text style={styles.itemStatus}>Todos los miembros</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </TouchableOpacity>
      )}

      <View style={styles.tabContainer}>
        <TabButton value="contacts" label="Contactos" icon="people-outline" count={0} />
        <TabButton value="recent" label="Recientes" icon="chatbubbles-outline" count={totalUnread} />
        <TabButton value="projects" label="Proyectos" icon="folder-outline" count={0} />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'contacts' && (
        <FlatList
          data={sortedUsers}
          renderItem={renderUserItem}
          keyExtractor={(item) => `user-${item.id}`}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyText}>No hay contactos</Text>
            </View>
          }
        />
      )}

      {activeTab === 'recent' && (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => `conv-${item.id}`}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyText}>No hay conversaciones</Text>
            </View>
          }
        />
      )}

      {activeTab === 'projects' && (
        <FlatList
          data={projects}
          renderItem={renderProjectItem}
          keyExtractor={(item) => `project-${item.id}`}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyText}>No hay proyectos</Text>
            </View>
          }
        />
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loadingText: { color: '#9ca3af', marginTop: 12 },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#1e293b' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  generalChat: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  generalChatAvatar: { backgroundColor: '#6366f1' },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155', gap: 8 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#0f172a', gap: 4 },
  tabButtonActive: { backgroundColor: '#6366f1' },
  tabText: { color: '#9ca3af', fontSize: 12, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  tabBadge: { backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 18, alignItems: 'center' },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  listContainer: { paddingVertical: 8, flexGrow: 1 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  avatarContainer: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  projectAvatar: { backgroundColor: 'rgba(34, 197, 94, 0.2)' },
  avatarInitial: { color: '#6366f1', fontSize: 20, fontWeight: 'bold' },
  onlineIndicator: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#6b7280', borderWidth: 2, borderColor: '#0f172a' },
  online: { backgroundColor: '#22c55e' },
  itemContent: { flex: 1, marginLeft: 14 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  itemTime: { color: '#6b7280', fontSize: 12 },
  itemStatus: { color: '#9ca3af', fontSize: 14 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { color: '#9ca3af', fontSize: 14, flex: 1 },
  unreadBadge: { backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 16 },
  errorContainer: { padding: 16, alignItems: 'center' },
  errorText: { color: '#ef4444', fontSize: 14 },
  retryText: { color: '#6366f1', fontSize: 14, marginTop: 8 },
});

export default ChatListScreen;
