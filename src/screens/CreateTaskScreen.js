import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi, sprintsApi, tasksApi, teamsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CreateTaskScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [selectedResponsible, setSelectedResponsible] = useState(null);
  const [priority, setPriority] = useState('media');
  const [taskType, setTaskType] = useState('tarea');

  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);

  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showSprintPicker, setShowSprintPicker] = useState(false);
  const [showResponsiblePicker, setShowResponsiblePicker] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadSprints(selectedProject.id);
    }
  }, [selectedProject]);

  const loadInitialData = async () => {
    setError(null);
    try {
      // Cargar proyectos
      let projectsData = [];
      try {
        projectsData = await projectsApi.getAll();
        if (Array.isArray(projectsData)) {
          projectsData = projectsData.filter(p => p.status === 'active' || !p.status);
        }
      } catch (e) {
        console.log('Error cargando proyectos:', e.message);
      }
      setProjects(projectsData);

      // Cargar usuarios (miembros del equipo del usuario)
      let usersData = [];
      try {
        if (user?.team_id) {
          usersData = await teamsApi.getMembers(user.team_id);
        }
        if (!Array.isArray(usersData) || usersData.length === 0) {
          // Fallback: cargar todos los usuarios si no hay miembros de equipo
          const allTeams = await teamsApi.getAll();
          if (Array.isArray(allTeams) && allTeams.length > 0) {
            usersData = await teamsApi.getMembers(allTeams[0].id);
          }
        }
      } catch (e) {
        console.log('Error cargando usuarios:', e.message);
      }

      if (Array.isArray(usersData)) {
        setUsers(usersData.filter(u => u.is_active !== false && u.is_active !== 0));
      }

      if (projectsData.length === 0) {
        setError('No hay proyectos disponibles');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('No se pudieron cargar los datos. Verifica tu conexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSprints = async (projectId) => {
    try {
      const data = await sprintsApi.getByProject(projectId);
      if (Array.isArray(data)) {
        const activeSprints = data.filter(s => s.status !== 'closed');
        setSprints(activeSprints);
        if (activeSprints.length > 0) {
          setSelectedSprint(activeSprints[0]);
        } else {
          setSelectedSprint(null);
        }
      }
    } catch (error) {
      console.error('Error loading sprints:', error);
      setSprints([]);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'El titulo es obligatorio');
      return;
    }
    if (!selectedProject) {
      Alert.alert('Error', 'Selecciona un proyecto');
      return;
    }
    if (!selectedSprint) {
      Alert.alert('Error', 'Selecciona un sprint');
      return;
    }

    setIsSubmitting(true);
    try {
      await tasksApi.create(selectedSprint.id, {
        title: title.trim(),
        description: description.trim(),
        type: taskType,
        priority,
        responsible_id: selectedResponsible?.id || null,
        project_id: selectedProject.id,
      });

      Alert.alert('Exito', 'Tarea creada correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'No se pudo crear la tarea');
    } finally {
      setIsSubmitting(false);
    }
  };

  const PriorityButton = ({ value, label, color }) => (
    <TouchableOpacity
      style={[styles.priorityButton, priority === value && { backgroundColor: color + '20', borderColor: color }]}
      onPress={() => setPriority(value)}
    >
      <Ionicons
        name={priority === value ? 'radio-button-on' : 'radio-button-off'}
        size={18}
        color={priority === value ? color : '#6b7280'}
      />
      <Text style={[styles.priorityText, priority === value && { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  const TypeButton = ({ value, label, icon }) => (
    <TouchableOpacity
      style={[styles.typeButton, taskType === value && styles.typeButtonActive]}
      onPress={() => setTaskType(value)}
    >
      <Ionicons name={icon} size={18} color={taskType === value ? '#6366f1' : '#6b7280'} />
      <Text style={[styles.typeText, taskType === value && styles.typeTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const SelectButton = ({ label, value, onPress, placeholder, disabled }) => (
    <TouchableOpacity
      style={[styles.selectButton, disabled && styles.selectButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.selectLabel}>{label}</Text>
      <View style={styles.selectValueContainer}>
        <Text style={[styles.selectValue, !value && styles.selectPlaceholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#6b7280" />
      </View>
    </TouchableOpacity>
  );

  const PickerModal = ({ visible, items, onSelect, onClose, title, selectedId }) => {
    if (!visible) return null;

    return (
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerList}>
            {items.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>No hay opciones disponibles</Text>
              </View>
            ) : (
              items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.pickerItem, selectedId === item.id && styles.pickerItemSelected]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedId === item.id && styles.pickerItemTextSelected]}>
                    {item.name}
                  </Text>
                  {selectedId === item.id && <Ionicons name="checkmark" size={20} color="#6366f1" />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva Tarea</Text>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitText}>Crear</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={20} color="#fbbf24" />
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={loadInitialData}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Titulo *</Text>
          <TextInput
            style={styles.input}
            placeholder="Escribe el titulo de la tarea"
            placeholderTextColor="#6b7280"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descripcion</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe la tarea..."
            placeholderTextColor="#6b7280"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo</Text>
          <View style={styles.typeContainer}>
            <TypeButton value="tarea" label="Tarea" icon="checkmark-circle-outline" />
            <TypeButton value="bloqueo" label="Bloqueo" icon="hand-left-outline" />
            <TypeButton value="riesgo" label="Riesgo" icon="warning-outline" />
            <TypeButton value="nota" label="Nota" icon="document-text-outline" />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Prioridad</Text>
          <View style={styles.priorityContainer}>
            <PriorityButton value="alta" label="Alta" color="#ef4444" />
            <PriorityButton value="media" label="Media" color="#f59e0b" />
            <PriorityButton value="baja" label="Baja" color="#22c55e" />
          </View>
        </View>

        <SelectButton
          label="Proyecto *"
          value={selectedProject?.name}
          placeholder="Selecciona un proyecto"
          onPress={() => setShowProjectPicker(true)}
        />

        <SelectButton
          label="Sprint *"
          value={selectedSprint?.name}
          placeholder={selectedProject ? 'Selecciona un sprint' : 'Primero selecciona un proyecto'}
          onPress={() => selectedProject && setShowSprintPicker(true)}
          disabled={!selectedProject}
        />

        <SelectButton
          label="Responsable"
          value={selectedResponsible?.name}
          placeholder="Sin asignar"
          onPress={() => setShowResponsiblePicker(true)}
        />
      </ScrollView>

      <PickerModal
        visible={showProjectPicker}
        items={projects}
        onSelect={(project) => {
          setSelectedProject(project);
          setSelectedSprint(null);
        }}
        onClose={() => setShowProjectPicker(false)}
        title="Seleccionar Proyecto"
        selectedId={selectedProject?.id}
      />

      <PickerModal
        visible={showSprintPicker}
        items={sprints}
        onSelect={setSelectedSprint}
        onClose={() => setShowSprintPicker(false)}
        title="Seleccionar Sprint"
        selectedId={selectedSprint?.id}
      />

      <PickerModal
        visible={showResponsiblePicker}
        items={users}
        onSelect={setSelectedResponsible}
        onClose={() => setShowResponsiblePicker(false)}
        title="Seleccionar Responsable"
        selectedId={selectedResponsible?.id}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loadingText: { color: '#9ca3af', marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  submitButton: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '600' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251, 191, 36, 0.1)', padding: 12, gap: 8 },
  errorBannerText: { color: '#fbbf24', flex: 1, fontSize: 14 },
  retryText: { color: '#6366f1', fontWeight: '600' },
  form: { flex: 1 },
  formContent: { padding: 20, gap: 20 },
  inputGroup: { gap: 8 },
  label: { color: '#9ca3af', fontSize: 14, fontWeight: '500' },
  input: { backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  textArea: { height: 100, paddingTop: 14 },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', gap: 6 },
  typeButtonActive: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderColor: '#6366f1' },
  typeText: { color: '#9ca3af', fontSize: 14 },
  typeTextActive: { color: '#6366f1' },
  priorityContainer: { flexDirection: 'row', gap: 10 },
  priorityButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', gap: 6 },
  priorityText: { color: '#9ca3af', fontSize: 14, fontWeight: '500' },
  selectButton: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  selectButtonDisabled: { opacity: 0.5 },
  selectLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 6 },
  selectValueContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectValue: { color: '#fff', fontSize: 16 },
  selectPlaceholder: { color: '#6b7280' },
  pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerContainer: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155' },
  pickerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  pickerList: { padding: 10 },
  pickerEmpty: { padding: 40, alignItems: 'center' },
  pickerEmptyText: { color: '#6b7280', fontSize: 16 },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 10, marginBottom: 4 },
  pickerItemSelected: { backgroundColor: 'rgba(99, 102, 241, 0.2)' },
  pickerItemText: { color: '#fff', fontSize: 16 },
  pickerItemTextSelected: { color: '#6366f1', fontWeight: '500' },
});

export default CreateTaskScreen;
