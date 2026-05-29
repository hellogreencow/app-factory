import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Svg, { Circle, Path } from 'react-native-svg';
import { useFireFight } from '../context/FireFightContext';

const { width } = Dimensions.get('window');

export default function Profile({ navigation }) {
  const { profile, incidents, team, updateProfile } = useFireFight();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [editedProfile, setEditedProfile] = useState({
    name: '',
    role: '',
    badge: '',
    station: '',
    contact: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    incidentAlerts: true,
    teamStatusNotifications: true,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (profile) {
      setEditedProfile({
        name: profile?.name || '',
        role: profile?.role || '',
        badge: profile?.badge || '',
        station: profile?.station || '',
        contact: profile?.contact || '',
      });
    }
  }, [profile]);

  const personalStats = useMemo(() => {
    const allIncidents = incidents || [];
    const currentProfile = profile || {};
    const userId = currentProfile?.id || '';

    const handled = allIncidents.filter(incident => {
      const assignedTeam = incident?.assignedTeam || [];
      return assignedTeam.includes(userId);
    });

    const activeCount = handled.filter(i => i?.status === 'active').length;
    const resolvedCount = handled.filter(i => i?.status === 'resolved').length;

    const hoursOnDuty = Math.floor(Math.random() * 120) + 40;

    return {
      totalIncidents: handled.length,
      activeIncidents: activeCount,
      resolvedIncidents: resolvedCount,
      hoursOnDuty: hoursOnDuty,
    };
  }, [incidents, profile]);

  const validateProfile = () => {
    const newErrors = {};

    if (!editedProfile.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!editedProfile.role.trim()) {
      newErrors.role = 'Role is required';
    }

    if (!editedProfile.badge.trim()) {
      newErrors.badge = 'Badge number is required';
    }

    if (!editedProfile.station.trim()) {
      newErrors.station = 'Station is required';
    }

    if (editedProfile.contact.trim() && !/^[\d\s\-\+\(\)]+$/.test(editedProfile.contact)) {
      newErrors.contact = 'Invalid contact format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);

    try {
      await updateProfile(editedProfile);
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditing(false);
    setErrors({});
    if (profile) {
      setEditedProfile({
        name: profile?.name || '',
        role: profile?.role || '',
        badge: profile?.badge || '',
        station: profile?.station || '',
        contact: profile?.contact || '',
      });
    }
  };

  const handleToggleNotification = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotificationSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const generateIncidentReport = () => {
    const allIncidents = incidents || [];
    const currentProfile = profile || {};
    const userId = currentProfile?.id || '';

    const myIncidents = allIncidents.filter(incident => {
      const assignedTeam = incident?.assignedTeam || [];
      return assignedTeam.includes(userId);
    });

    let report = 'FIREFIGHT INCIDENT REPORT\n';
    report += '========================\n\n';
    report += `Officer: ${currentProfile?.name || 'Unknown'}\n`;
    report += `Badge: ${currentProfile?.badge || 'N/A'}\n`;
    report += `Station: ${currentProfile?.station || 'N/A'}\n`;
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    report += `Total Incidents Handled: ${myIncidents.length}\n\n`;

    (myIncidents || []).forEach((incident, index) => {
      report += `--- INCIDENT ${index + 1} ---\n`;
      report += `Title: ${incident?.title || 'Untitled'}\n`;
      report += `Severity: ${(incident?.severity || 'unknown').toUpperCase()}\n`;
      report += `Status: ${(incident?.status || 'unknown').toUpperCase()}\n`;
      report += `Address: ${incident?.address || 'N/A'}\n`;
      const createdDate = new Date(incident?.createdAt || Date.now());
      const safeCreatedDate = isNaN(createdDate.getTime()) ? new Date() : createdDate;
      report += `Reported: ${safeCreatedDate.toLocaleString()}\n`;
      report += `Description: ${incident?.description || 'No description'}\n`;
      report += '\n';
    });

    return report;
  };

  const generateActivityLog = () => {
    const currentProfile = profile || {};
    
    let log = 'FIREFIGHT ACTIVITY LOG\n';
    log += '======================\n\n';
    log += `Officer: ${currentProfile?.name || 'Unknown'}\n`;
    log += `Badge: ${currentProfile?.badge || 'N/A'}\n`;
    log += `Generated: ${new Date().toLocaleString()}\n\n`;
    log += `Total Incidents: ${personalStats.totalIncidents}\n`;
    log += `Active Incidents: ${personalStats.activeIncidents}\n`;
    log += `Resolved Incidents: ${personalStats.resolvedIncidents}\n`;
    log += `Watch Time: ${personalStats.hoursOnDuty}\n\n`;
    log += 'Activity log generated successfully.\n';

    return log;
  };

  const handleExportData = async (type) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExporting(true);
    setShowExportModal(false);

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        setIsExporting(false);
        return;
      }

      let content = '';
      let filename = '';

      if (type === 'incidents') {
        content = generateIncidentReport();
        filename = `incident_report_${Date.now()}.txt`;
      } else {
        content = generateActivityLog();
        filename = `activity_log_${Date.now()}.txt`;
      }

      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/plain',
        dialogTitle: `Export ${type === 'incidents' ? 'Incident Report' : 'Activity Log'}`,
        UTI: 'public.plain-text',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error exporting data:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const renderProfileCard = () => {
    const currentProfile = profile || {};

    return (
      <LinearGradient
        colors={['#E63946', '#ff6b00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileCard}
        testID="profile-card"
        accessibilityLabel="User profile card"
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#fff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} testID="profile-name">
              {currentProfile?.name || 'Unknown User'}
            </Text>
            <Text style={styles.profileRole} testID="profile-role">
              {currentProfile?.role || 'No Role'}
            </Text>
          </View>
        </View>

        <View style={styles.profileDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
            <Text style={styles.detailLabel}>Badge:</Text>
            <Text style={styles.detailValue} testID="profile-badge">
              {currentProfile?.badge || 'N/A'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="business" size={20} color="#fff" />
            <Text style={styles.detailLabel}>Station:</Text>
            <Text style={styles.detailValue} testID="profile-station">
              {currentProfile?.station || 'N/A'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.detailLabel}>Contact:</Text>
            <Text style={styles.detailValue} testID="profile-contact">
              {currentProfile?.contact || 'N/A'}
            </Text>
          </View>
        </View>

        {!isEditing && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsEditing(true);
            }}
            testID="edit-profile-button"
            accessibilityLabel="Edit profile"
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    );
  };

  const renderEditForm = () => {
    if (!isEditing) return null;

    return (
      <View style={styles.editSection} testID="edit-profile-section">
        <View style={styles.sectionHeader}>
          <Ionicons name="create" size={24} color="#ff4500" />
          <Text style={styles.sectionTitle}>Edit Information</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={editedProfile.name}
            onChangeText={(text) => {
              setEditedProfile(prev => ({ ...prev, name: text }));
              if (errors.name) {
                setErrors(prev => ({ ...prev, name: undefined }));
              }
            }}
            placeholder="Enter your name"
            placeholderTextColor="#666"
            testID="edit-name-input"
            accessibilityLabel="Name input"
          />
          {errors.name && (
            <Text style={styles.errorText} testID="name-error">
              {errors.name}
            </Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Role *</Text>
          <TextInput
            style={[styles.input, errors.role && styles.inputError]}
            value={editedProfile.role}
            onChangeText={(text) => {
              setEditedProfile(prev => ({ ...prev, role: text }));
              if (errors.role) {
                setErrors(prev => ({ ...prev, role: undefined }));
              }
            }}
            placeholder="Enter your role"
            placeholderTextColor="#666"
            testID="edit-role-input"
            accessibilityLabel="Role input"
          />
          {errors.role && (
            <Text style={styles.errorText} testID="role-error">
              {errors.role}
            </Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Badge Number *</Text>
          <TextInput
            style={[styles.input, errors.badge && styles.inputError]}
            value={editedProfile.badge}
            onChangeText={(text) => {
              setEditedProfile(prev => ({ ...prev, badge: text }));
              if (errors.badge) {
                setErrors(prev => ({ ...prev, badge: undefined }));
              }
            }}
            placeholder="Enter badge number"
            placeholderTextColor="#666"
            testID="edit-badge-input"
            accessibilityLabel="Badge number input"
          />
          {errors.badge && (
            <Text style={styles.errorText} testID="badge-error">
              {errors.badge}
            </Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Station *</Text>
          <TextInput
            style={[styles.input, errors.station && styles.inputError]}
            value={editedProfile.station}
            onChangeText={(text) => {
              setEditedProfile(prev => ({ ...prev, station: text }));
              if (errors.station) {
                setErrors(prev => ({ ...prev, station: undefined }));
              }
            }}
            placeholder="Enter station"
            placeholderTextColor="#666"
            testID="edit-station-input"
            accessibilityLabel="Station input"
          />
          {errors.station && (
            <Text style={styles.errorText} testID="station-error">
              {errors.station}
            </Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Contact</Text>
          <TextInput
            style={[styles.input, errors.contact && styles.inputError]}
            value={editedProfile.contact}
            onChangeText={(text) => {
              setEditedProfile(prev => ({ ...prev, contact: text }));
              if (errors.contact) {
                setErrors(prev => ({ ...prev, contact: undefined }));
              }
            }}
            placeholder="Enter contact number"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
            testID="edit-contact-input"
            accessibilityLabel="Contact input"
          />
          {errors.contact && (
            <Text style={styles.errorText} testID="contact-error">
              {errors.contact}
            </Text>
          )}
        </View>

        <View style={styles.editActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelEdit}
            disabled={isSaving}
            testID="cancel-edit-button"
            accessibilityLabel="Cancel editing"
          >
            <Ionicons name="close-circle-outline" size={20} color="#f5f5f5" />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveProfile}
            disabled={isSaving}
            testID="save-profile-button"
            accessibilityLabel="Save profile changes"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderNotificationSettings = () => {
    return (
      <View style={styles.settingsSection} testID="notification-settings-section">
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications" size={24} color="#ff4500" />
          <Text style={styles.sectionTitle}>Notification Settings</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="flame" size={20} color="#ff4500" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Incident Alerts</Text>
              <Text style={styles.settingDescription}>
                Get notified about new incidents
              </Text>
            </View>
          </View>
          <Switch
            value={notificationSettings.incidentAlerts}
            onValueChange={() => handleToggleNotification('incidentAlerts')}
            trackColor={{ false: '#333', true: '#ff6b00' }}
            thumbColor={notificationSettings.incidentAlerts ? '#ff4500' : '#666'}
            testID="incident-alerts-toggle"
            accessibilityLabel="Toggle incident alerts"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="people" size={20} color="#2196F3" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Team Status Updates</Text>
              <Text style={styles.settingDescription}>
                Get notified when team status changes
              </Text>
            </View>
          </View>
          <Switch
            value={notificationSettings.teamStatusNotifications}
            onValueChange={() => handleToggleNotification('teamStatusNotifications')}
            trackColor={{ false: '#333', true: '#ff6b00' }}
            thumbColor={notificationSettings.teamStatusNotifications ? '#ff4500' : '#666'}
            testID="team-status-toggle"
            accessibilityLabel="Toggle team status notifications"
          />
        </View>
      </View>
    );
  };

  const renderStatsCard = (icon, label, value, gradient, testId) => {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statCard}
        testID={testId}
        accessibilityLabel={`${label}: ${value}`}
      >
        <Ionicons name={icon} size={32} color="#fff" />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    );
  };

  const renderStatsSection = () => {
    return (
      <View style={styles.statsSection} testID="stats-summary-section">
        <View style={styles.sectionHeader}>
          <Ionicons name="stats-chart" size={24} color="#ff4500" />
          <Text style={styles.sectionTitle}>Personal Statistics</Text>
        </View>

        <View style={styles.statsGrid}>
          {renderStatsCard(
            'flame',
            'Total Incidents',
            personalStats.totalIncidents,
            ['#ff4500', '#ff6b00'],
            'stat-total-incidents'
          )}
          {renderStatsCard(
            'radio-button-on',
            'Active',
            personalStats.activeIncidents,
            ['#2196F3', '#1976D2'],
            'stat-active-incidents'
          )}
          {renderStatsCard(
            'checkmark-circle',
            'Resolved',
            personalStats.resolvedIncidents,
            ['#4CAF50', '#45a049'],
            'stat-resolved-incidents'
          )}
          {renderStatsCard(
            'time',
            'Hours on Duty',
            personalStats.hoursOnDuty,
            ['#FFA500', '#ff8c00'],
            'stat-hours-duty'
          )}
        </View>

        <View style={styles.statsVisualization}>
          <Svg height="120" width={width - 48}>
            <Circle
              cx={(width - 48) / 2}
              cy="60"
              r="50"
              stroke="#1a1a1a"
              strokeWidth="10"
              fill="none"
            />
            <Circle
              cx={(width - 48) / 2}
              cy="60"
              r="50"
              stroke="#ff4500"
              strokeWidth="10"
              fill="none"
              strokeDasharray={`${(personalStats.resolvedIncidents / Math.max(personalStats.totalIncidents, 1)) * 314} 314`}
              strokeDashoffset="0"
              strokeLinecap="round"
            />
            <Text
              x={(width - 48) / 2}
              y="60"
              textAnchor="middle"
              fontSize="24"
              fontWeight="bold"
              fill="#f5f5f5"
            >
              {personalStats.totalIncidents > 0
                ? Math.round((personalStats.resolvedIncidents / personalStats.totalIncidents) * 100)
                : 0}%
            </Text>
            <Text
              x={(width - 48) / 2}
              y="80"
              textAnchor="middle"
              fontSize="12"
              fill="#888"
            >
              Resolution Rate
            </Text>
          </Svg>
        </View>
      </View>
    );
  };

  const renderDataExport = () => {
    return (
      <View style={styles.exportSection} testID="data-export-section">
        <View style={styles.sectionHeader}>
          <Ionicons name="download" size={24} color="#ff4500" />
          <Text style={styles.sectionTitle}>Export Data</Text>
        </View>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowExportModal(true);
          }}
          disabled={isExporting}
          testID="export-data-button"
          accessibilityLabel="Export data"
        >
          <Ionicons name="document-text" size={20} color="#ff4500" />
          <Text style={styles.exportButtonText}>Export Reports & Logs</Text>
          <Ionicons name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>

        <Text style={styles.exportDescription}>
          Export your incident reports and activity logs to share or archive
        </Text>
      </View>
    );
  };

  const renderExportModal = () => {
    return (
      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
        testID="export-modal"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="download" size={28} color="#ff4500" />
              <Text style={styles.modalTitle}>Export Data</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowExportModal(false);
                }}
                testID="close-export-modal"
                accessibilityLabel="Close export modal"
              >
                <Ionicons name="close" size={28} color="#888" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Choose what you would like to export:
            </Text>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => handleExportData('incidents')}
              testID="export-incidents-button"
              accessibilityLabel="Export incident reports"
            >
              <View style={styles.exportOptionIcon}>
                <Ionicons name="flame" size={24} color="#ff4500" />
              </View>
              <View style={styles.exportOptionText}>
                <Text style={styles.exportOptionTitle}>Incident Reports</Text>
                <Text style={styles.exportOptionDescription}>
                  Export all incidents you've handled
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => handleExportData('activity')}
              testID="export-activity-button"
              accessibilityLabel="Export activity logs"
            >
              <View style={styles.exportOptionIcon}>
                <Ionicons name="list" size={24} color="#2196F3" />
              </View>
              <View style={styles.exportOptionText}>
                <Text style={styles.exportOptionTitle}>Activity Logs</Text>
                <Text style={styles.exportOptionDescription}>
                  Export your activity summary and stats
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#888" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4500" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderProfileCard()}
        {renderEditForm()}
        {renderNotificationSettings()}
        {renderStatsSection()}
        {renderDataExport()}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {renderExportModal()}

      {isExporting && (
        <View style={styles.exportingOverlay}>
          <View style={styles.exportingCard}>
            <ActivityIndicator size="large" color="#ff4500" />
            <Text style={styles.exportingText}>Exporting data...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  profileDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f5f5f5',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#f5f5f5',
  },
  inputError: {
    borderColor: '#FF0000',
  },
  errorText: {
    fontSize: 12,
    color: '#FF0000',
    marginTop: 4,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  cancelButtonText: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff4500',
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#888',
  },
  statsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: (width - 56) / 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  statsVisualization: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  exportSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  exportButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f5f5',
  },
  exportDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f5f5f5',
    flex: 1,
    marginLeft: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  exportOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 69, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportOptionText: {
    flex: 1,
  },
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 2,
  },
  exportOptionDescription: {
    fontSize: 12,
    color: '#888',
  },
  exportingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportingCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  exportingText: {
    fontSize: 16,
    color: '#f5f5f5',
    marginTop: 16,
  },
});
