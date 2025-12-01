import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { tasksApi, teamsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  pendiente: '#fbbf24',
  en_progreso: '#3b82f6',
  bloqueada: '#ef4444',
  hecha: '#22c55e',
  cancelada: '#6b7280',
  esperando: '#a855f7',
};

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_progreso: 'En Progreso',
  bloqueada: 'Bloqueada',
  hecha: 'Hecha',
  cancelada: 'Cancelada',
  esperando: 'Esperando',
};

const PRIORITY_ICONS = {
  alta: 'arrow-up-circle',
  media: 'remove-circle',
  baja: 'arrow-down-circle',
};

const PRIORITY_COLORS = {
  alta: '#ef4444',
  media: '#f59e0b',
  baja: '#22c55e',
};

const TasksListScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  const loadData = async () => {
    setError(null);
    try {
      // Cargar equipos
      const teamsData = await teamsApi.getAll();
      if (Array.isArray(teamsData) && teamsData.length > 0) {
        setTeams(teamsData);

        // Seleccionar el equipo del usuario o el primero
        const teamToSelect = user?.team_id
          ? teamsData.find(t => t.id === user.team_id) || teamsData[0]
          : teamsData[0];

        setSelectedTeam(teamToSelect);

        // Cargar tareas del equipo seleccionado
        await loadTasksForTeam(teamToSelect.id);
      } else {
        setTasks([]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error al cargar datos');
      setIsLoading(false);
    }
  };

  const loadTasksForTeam = async (teamId) => {
    try {
      const tasksData = await tasksApi.getOpenTasksByTeam(teamId);
      if (Array.isArray(tasksData)) {
        setTasks(tasksData);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadData();
    }, [user?.team_id])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    if (selectedTeam) {
      loadTasksForTeam(selectedTeam.id);
    } else {
      loadData();
    }
  };

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    setIsLoading(true);
    loadTasksForTeam(team.id);
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'mine') {
      return task.responsible_id === user?.id || task.creator_id === user?.id;
    }
    if (filter === 'pending') {
      return ['pendiente', 'en_progreso', 'bloqueada', 'esperando'].includes(task.status);
    }
    return true;
  });

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const isOverdue = (task) => {
    if (!task.committed_date || task.status === 'hecha' || task.status === 'cancelada') return false;
    return new Date(task.committed_date) < new Date();
  };

  const renderTask = ({ item }) => {
    const overdue = isOverdue(item);
    const statusColor = STATUS_COLORS[item.status] || '#6b7280';

    return (
      <TouchableOpacity
        style={[styles.taskCard, overdue && styles.taskCardOverdue]}
        onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
      >
        <View style={styles.taskHeader}>
          <View style={styles.taskTitleRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.taskTitle} numberOfLines={2}>{item.title}</Text>
          </View>
          {item.priority && (
            <Ionicons
              name={PRIORITY_ICONS[item.priority] || 'remove-circle'}
              size={20}
              color={PRIORITY_COLORS[item.priority] || '#f59e0b'}
            />
          )}
        </View>

        <View style={styles.taskInfo}>
          <View style={styles.taskMeta}>
            {item.project_name && (
              <View style={styles.metaItem}>
                <Ionicons name="folder-outline" size={14} color="#6b7280" />
                <Text style={styles.metaText} numberOfLines={1}>{item.project_name}</Text>
              </View>
            )}
            {item.responsible_name && (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={14} color="#6b7280" />
                <Text style={styles.metaText} numberOfLines={1}>{item.responsible_name}</Text>
              </View>
            )}
          </View>

          <View style={styles.taskFooter}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABELS[item.status] || item.status}
              </Text>
            </View>
            {item.committed_date && (
              <View style={[styles.dateContainer, overdue && styles.dateOverdue]}>
                <Ionicons name="calendar-outline" size={14} color={overdue ? '#ef4444' : '#6b7280'} />
                <Text style={[styles.dateText, overdue && styles.dateTextOverdue]}>
                  {formatDate(item.committed_date)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const FilterButton = ({ value, label, icon }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Ionicons name={icon} size={16} color={filter === value ? '#fff' : '#9ca3af'} />
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Cargando tareas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tareas</Text>
        <Text style={styles.headerSubtitle}>
          {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {teams.length > 0 && (
        <View style={styles.teamSelector}>
          <FlatList
            horizontal
            data={teams}
            keyExtractor={(item) => item.id.toString()}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.teamButton, selectedTeam?.id === item.id && styles.teamButtonActive]}
                onPress={() => handleTeamSelect(item)}
              >
                <Text style={[styles.teamButtonText, selectedTeam?.id === item.id && styles.teamButtonTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.teamList}
          />
        </View>
      )}

      <View style={styles.filterContainer}>
        <FilterButton value="all" label="Todas" icon="list-outline" />
        <FilterButton value="mine" label="Mis Tareas" icon="person-outline" />
        <FilterButton value="pending" label="Pendientes" icon="time-outline" />
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
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        contentContainerStyle={styles.tasksList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-outline" size={64} color="#4b5563" />
            <Text style={styles.emptyText}>No hay tareas</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'mine' ? 'No tienes tareas asignadas' : 'No hay tareas en este equipo'}
            </Text>
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
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#1e293b' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
  teamSelector: { backgroundColor: '#1e293b', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  teamList: { paddingHorizontal: 16 },
  teamButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0f172a', marginRight: 8 },
  teamButtonActive: { backgroundColor: '#6366f1' },
  teamButtonText: { color: '#9ca3af', fontSize: 14, fontWeight: '500' },
  teamButtonTextActive: { color: '#fff' },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  filterButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0f172a', gap: 6 },
  filterButtonActive: { backgroundColor: '#6366f1' },
  filterText: { color: '#9ca3af', fontSize: 13, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  tasksList: { padding: 16 },
  taskCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#6366f1' },
  taskCardOverdue: { borderLeftColor: '#ef4444' },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  taskTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  taskInfo: { gap: 10 },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#9ca3af', fontSize: 13 },
  taskFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '500' },
  dateContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateOverdue: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  dateText: { color: '#6b7280', fontSize: 13 },
  dateTextOverdue: { color: '#ef4444' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center' },
  errorContainer: { padding: 16, alignItems: 'center' },
  errorText: { color: '#ef4444', fontSize: 14 },
  retryText: { color: '#6366f1', fontSize: 14, marginTop: 8 },
});

export default TasksListScreen;
