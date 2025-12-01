import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { tasksApi } from '../services/api';

const STATUS_COLORS = {
  pendiente: '#fbbf24',
  en_progreso: '#3b82f6',
  bloqueada: '#ef4444',
  hecha: '#22c55e',
  cancelada: '#6b7280',
};

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_progreso: 'En Progreso',
  bloqueada: 'Bloqueada',
  hecha: 'Hecha',
  cancelada: 'Cancelada',
};

const PRIORITY_LABELS = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

const TYPE_ICONS = {
  tarea: 'checkmark-circle-outline',
  bloqueo: 'hand-left-outline',
  riesgo: 'warning-outline',
  nota: 'document-text-outline',
};

const TaskDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { taskId } = route.params;

  const [task, setTask] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    try {
      const data = await tasksApi.getOne(taskId);
      setTask(data);
    } catch (error) {
      console.error('Error loading task:', error);
      Alert.alert('Error', 'No se pudo cargar la tarea');
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    setIsUpdating(true);
    try {
      await tasksApi.update(taskId, { status: newStatus });
      setTask({ ...task, status: newStatus });
      Alert.alert('Exito', 'Estado actualizado');
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Tarea no encontrada</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Tarea</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[task.status] + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[task.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[task.status] }]}>
            {STATUS_LABELS[task.status]}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{task.title}</Text>

        {/* Meta Info */}
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Ionicons name={TYPE_ICONS[task.type]} size={18} color="#6366f1" />
            <Text style={styles.metaText}>{task.type}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="flag-outline" size={18} color="#f59e0b" />
            <Text style={styles.metaText}>Prioridad {PRIORITY_LABELS[task.priority]}</Text>
          </View>
        </View>

        {/* Description */}
        {task.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descripcion</Text>
            <Text style={styles.description}>{task.description}</Text>
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="folder-outline" size={20} color="#6b7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Proyecto</Text>
              <Text style={styles.detailValue}>{task.project_name || 'Sin proyecto'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="person-outline" size={20} color="#6b7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Responsable</Text>
              <Text style={styles.detailValue}>{task.responsible_name || 'Sin asignar'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="calendar-outline" size={20} color="#6b7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Fecha Comprometida</Text>
              <Text style={styles.detailValue}>{formatDate(task.committed_date)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="time-outline" size={20} color="#6b7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Creada</Text>
              <Text style={styles.detailValue}>{formatDate(task.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cambiar Estado</Text>
          <View style={styles.actionsGrid}>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.actionButton,
                  task.status === status && styles.actionButtonActive,
                  { borderColor: STATUS_COLORS[status] },
                ]}
                onPress={() => updateStatus(status)}
                disabled={isUpdating || task.status === status}
              >
                <View style={[styles.actionDot, { backgroundColor: STATUS_COLORS[status] }]} />
                <Text style={[styles.actionText, { color: STATUS_COLORS[status] }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {isUpdating && (
        <View style={styles.updatingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}
    </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#1e293b',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  metaContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#9ca3af',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 24,
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    color: '#fff',
    fontSize: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#1e293b',
    gap: 8,
  },
  actionButtonActive: {
    opacity: 0.5,
  },
  actionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  updatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TaskDetailScreen;
