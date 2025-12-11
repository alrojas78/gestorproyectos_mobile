import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supportApi } from '../services/api';
import socketService from '../services/socketService';
import { useAuth } from '../context/AuthContext';

const SupportListScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('active');
  const [error, setError] = useState(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const loadData = async () => {
    setError(null);
    try {
      // Cargar sesiones de soporte
      const response = await supportApi.getSessions({ status: activeFilter === 'all' ? '' : activeFilter });
      if (response.success && Array.isArray(response.sessions)) {
        setSessions(response.sessions);
      } else if (Array.isArray(response)) {
        setSessions(response);
      }

      // Cargar total de no leídos
      try {
        const unreadResponse = await supportApi.getUnreadTotal();
        if (unreadResponse.success) {
          setUnreadTotal(unreadResponse.total || 0);
        }
      } catch (e) {
        console.log('Error cargando unread total:', e.message);
      }
    } catch (error) {
      console.error('Error cargando sesiones:', error.message);
      setError('Error al cargar sesiones de soporte');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Conectar como agente de soporte
      socketService.connectAsAgent();
    }, [activeFilter])
  );

  // Escuchar eventos de soporte en tiempo real
  useEffect(() => {
    const handleNewSession = (data) => {
      setSessions((prev) => {
        const exists = prev.some(s => s.id === data.session?.id);
        if (!exists && data.session) {
          return [data.session, ...prev];
        }
        return prev;
      });
      setUnreadTotal((prev) => prev + 1);
    };

    const handleSessionUpdated = (data) => {
      setSessions((prev) =>
        prev.map(s =>
          s.id === data.sessionId
            ? { ...s, last_message: data.lastMessage, unread_count: data.unreadCount || s.unread_count }
            : s
        )
      );
    };

    const handleSupportMessage = (data) => {
      // Actualizar lista si el mensaje es de una sesión existente
      if (data.sessionId && data.message) {
        setSessions((prev) =>
          prev.map(s =>
            s.id === data.sessionId
              ? { ...s, last_message: data.message.content, unread_count: (s.unread_count || 0) + 1 }
              : s
          )
        );
      }
    };

    socketService.on('new_support_session', handleNewSession);
    socketService.on('session_updated', handleSessionUpdated);
    socketService.on('support_message', handleSupportMessage);

    return () => {
      socketService.off('new_support_session', handleNewSession);
      socketService.off('session_updated', handleSessionUpdated);
      socketService.off('support_message', handleSupportMessage);
    };
  }, []);

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return '#f59e0b'; // Amarillo
      case 'active': return '#22c55e'; // Verde
      case 'assigned': return '#6366f1'; // Morado
      case 'escalated': return '#ef4444'; // Rojo
      case 'closed': return '#6b7280'; // Gris
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'waiting': return 'Esperando';
      case 'active': return 'Activa';
      case 'assigned': return 'Asignada';
      case 'escalated': return 'Escalada';
      case 'closed': return 'Cerrada';
      default: return status;
    }
  };

  const getHandlerBadge = (session) => {
    if (session.handled_by === 'bot') {
      return { label: 'Bot', color: '#a855f7' }; // Morado
    } else if (session.handled_by === 'agent') {
      return { label: 'Agente', color: '#22c55e' }; // Verde
    } else if (session.status === 'escalated') {
      return { label: 'Escalada', color: '#ef4444' }; // Rojo
    }
    return null;
  };

  const handleSessionClick = (session) => {
    navigation.navigate('SupportConversation', {
      sessionId: session.id,
      customerName: session.external_name || session.customer_name || 'Cliente',
      status: session.status,
    });
  };

  const renderSessionItem = ({ item }) => {
    const unreadCount = parseInt(item.unread_count) || 0;
    const handlerBadge = getHandlerBadge(item);

    return (
      <TouchableOpacity style={styles.listItem} onPress={() => handleSessionClick(item)}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="headset" size={24} color="#6366f1" />
          </View>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <View style={styles.nameContainer}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.external_name || item.customer_name || 'Cliente'}
              </Text>
              {handlerBadge && (
                <View style={[styles.handlerBadge, { backgroundColor: handlerBadge.color }]}>
                  <Text style={styles.handlerBadgeText}>{handlerBadge.label}</Text>
                </View>
              )}
            </View>
            <Text style={styles.itemTime}>{formatTime(item.last_activity || item.created_at)}</Text>
          </View>
          <View style={styles.itemFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.last_message || item.external_email || 'Nueva conversación'}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
            {item.project_name && (
              <Text style={styles.projectName} numberOfLines={1}>📁 {item.project_name}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const FilterButton = ({ value, label, count }) => (
    <TouchableOpacity
      style={[styles.filterButton, activeFilter === value && styles.filterButtonActive]}
      onPress={() => setActiveFilter(value)}
    >
      <Text style={[styles.filterText, activeFilter === value && styles.filterTextActive]}>{label}</Text>
      {count > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Cargando soporte...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Soporte</Text>
        {unreadTotal > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{unreadTotal}</Text>
          </View>
        )}
      </View>

      <View style={styles.filterContainer}>
        <FilterButton value="active" label="Activas" count={sessions.filter(s => s.status === 'active' || s.status === 'assigned').length} />
        <FilterButton value="waiting" label="Esperando" count={sessions.filter(s => s.status === 'waiting').length} />
        <FilterButton value="escalated" label="Escaladas" count={sessions.filter(s => s.status === 'escalated').length} />
        <FilterButton value="all" label="Todas" count={0} />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={sessions}
        renderItem={renderSessionItem}
        keyExtractor={(item) => `session-${item.id}`}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="headset-outline" size={64} color="#4b5563" />
            <Text style={styles.emptyText}>No hay sesiones de soporte</Text>
            <Text style={styles.emptySubtext}>Las consultas de clientes apareceran aqui</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loadingText: { color: '#9ca3af', marginTop: 12 },
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
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  headerBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    gap: 4,
  },
  filterButtonActive: { backgroundColor: '#6366f1' },
  filterText: { color: '#9ca3af', fontSize: 11, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  filterBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  listContainer: { paddingVertical: 8, flexGrow: 1 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  itemContent: { flex: 1, marginLeft: 14 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  itemName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  handlerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  handlerBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  itemTime: { color: '#6b7280', fontSize: 12 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  lastMessage: { color: '#9ca3af', fontSize: 14, flex: 1 },
  unreadBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  projectName: { color: '#6b7280', fontSize: 11, flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 16 },
  emptySubtext: { color: '#4b5563', fontSize: 14, marginTop: 4 },
  errorContainer: { padding: 16, alignItems: 'center' },
  errorText: { color: '#ef4444', fontSize: 14 },
  retryText: { color: '#6366f1', fontSize: 14, marginTop: 8 },
});

export default SupportListScreen;
