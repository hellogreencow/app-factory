import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { LongPressGestureHandler, State } from 'react-native-gesture-handler';
import { useFireFight } from '../context/FireFightContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const STATUS_COLORS = {
  available: '#4CAF50',
  'on-duty': '#2196F3',
  'off-duty': '#757575',
  emergency: '#FF0000',
};

const STATUS_GRADIENTS = {
  available: ['#4CAF50', '#45a049'],
  'on-duty': ['#2196F3', '#1976D2'],
  'off-duty': ['#757575', '#616161'],
  emergency: ['#FF0000', '#cc0000'],
};

const STATUS_ICONS = {
  available: 'checkmark-circle',
  'on-duty': 'radio-button-on',
  'off-duty': 'moon',
  emergency: 'alert-circle',
};

const STAT_GRADIENTS = {
  total: ['#2196F3', '#1976D2'],
  available: ['#4CAF50', '#45a049'],
  onDuty: ['#ff4500', '#ff6b00'],
};

export default function TeamStatus({ navigation }) {
  const { team, incidents, teamStats } = useFireFight();

  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const statusCounts = useMemo(() => {
    const allTeam = team || [];
    return {
      all: allTeam.length,
      available: allTeam.filter(m => m?.status === 'available').length,
      'on-duty': allTeam.filter(m => m?.status === 'on-duty').length,
      'off-duty': allTeam.filter(m => m?.status === 'off-duty').length,
      emergency: allTeam.filter(m => m?.status === 'emergency').length,
    };
  }, [team]);

  const filteredTeam = useMemo(() => {
    let filtered = team || [];

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(member => member?.status === selectedStatus);
    }

    return filtered.sort((a, b) => {
      const nameA = a?.name?.toLowerCase() || '';
      const nameB = b?.name?.toLowerCase() || '';
      return nameA.localeCompare(nameB);
    });
  }, [team, selectedStatus]);

  const getIncidentForMember = (memberId) => {
    const allIncidents = incidents || [];
    return allIncidents.find(incident => {
      const assignedTeam = incident?.assignedTeam || [];
      return assignedTeam.includes(memberId) && incident?.status === 'active';
    });
  };

  const handleLongPress = (event, member) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedMember(member);
      setShowContactModal(true);
    }
  };

  const handleCall = () => {
    if (!selectedMember?.contact) {
      Alert.alert('Error', 'No contact information available');
      return;
    }

    const phoneNumber = selectedMember.contact.replace(/[^0-9]/g, '');
    const url = Platform.OS === 'ios' ? `telprompt:${phoneNumber}` : `tel:${phoneNumber}`;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
    setShowContactModal(false);
  };

  const handleMessage = () => {
    if (!selectedMember?.contact) {
      Alert.alert('Error', 'No contact information available');
      return;
    }

    const phoneNumber = selectedMember.contact.replace(/[^0-9]/g, '');
    const url = Platform.OS === 'ios' ? `sms:${phoneNumber}` : `sms:${phoneNumber}`;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to send message');
    });
    setShowContactModal(false);
  };

  const handleViewDetails = () => {
    if (selectedMember) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowContactModal(false);
      navigation.navigate('TeamDetail', { id: selectedMember.id });
    }
  };

  const handleStatusFilterPress = (status) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStatus(status);
  };

  const handleCardPress = (member) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('TeamDetail', { id: member.id });
  };

  const getAvatarInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return 'No update';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid date';
    try {
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (err) {
      console.error('Date formatting error:', err);
      return 'Unknown';
    }
  };

  const renderStatsHeader = () => {
    const stats = teamStats || {
      total: statusCounts.all,
      available: statusCounts.available,
      onDuty: statusCounts['on-duty'],
    };

    return (
      <View style={styles.statsContainer} testID="stats-header">
        <LinearGradient
          colors={STAT_GRADIENTS.total}
          style={styles.statCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="people" size={32} color="#fff" />
          <Text style={styles.statValue} testID="stat-total-value">
            {stats.total}
          </Text>
          <Text style={styles.statLabel} testID="stat-total-label">
            Total Team
          </Text>
        </LinearGradient>

        <LinearGradient
          colors={STAT_GRADIENTS.available}
          style={styles.statCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="checkmark-circle" size={32} color="#fff" />
          <Text style={styles.statValue} testID="stat-available-value">
            {stats.available}
          </Text>
          <Text style={styles.statLabel} testID="stat-available-label">
            Available
          </Text>
        </LinearGradient>

        <LinearGradient
          colors={STAT_GRADIENTS.onDuty}
          style={styles.statCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="flame" size={32} color="#fff" />
          <Text style={styles.statValue} testID="stat-on-duty-value">
            {stats.onDuty}
          </Text>
          <Text style={styles.statLabel} testID="stat-on-duty-label">
            On Duty
          </Text>
        </LinearGradient>
      </View>
    );
  };

  const renderStatusFilters = () => {
    const filters = [
      { key: 'all', label: 'All', icon: 'apps', count: statusCounts.all },
      { key: 'available', label: 'Available', icon: 'checkmark-circle', count: statusCounts.available },
      { key: 'on-duty', label: 'On Duty', icon: 'radio-button-on', count: statusCounts['on-duty'] },
      { key: 'off-duty', label: 'Off Duty', icon: 'moon', count: statusCounts['off-duty'] },
      { key: 'emergency', label: 'Emergency', icon: 'alert-circle', count: statusCounts.emergency },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollView}
        contentContainerStyle={styles.filterContainer}
        testID="status-filter"
      >
        {filters.map((filter) => {
          const isSelected = selectedStatus === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                isSelected && styles.filterChipSelected,
                isSelected && filter.key !== 'all' && {
                  backgroundColor: STATUS_COLORS[filter.key],
                  borderColor: STATUS_COLORS[filter.key],
                },
              ]}
              onPress={() => handleStatusFilterPress(filter.key)}
              testID={`filter-chip-${filter.key}`}
              accessibilityLabel={`Filter by ${filter.label}`}
            >
              <Ionicons
                name={filter.icon}
                size={18}
                color={isSelected ? '#fff' : '#888'}
              />
              <Text
                style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextSelected,
                ]}
              >
                {filter.label}
              </Text>
              <View
                style={[
                  styles.filterChipBadge,
                  isSelected && styles.filterChipBadgeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipBadgeText,
                    isSelected && styles.filterChipBadgeTextSelected,
                  ]}
                >
                  {filter.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderTeamMemberCard = (member) => {
    const incident = getIncidentForMember(member?.id);
    const statusColor = STATUS_COLORS[member?.status || 'off-duty'];
    const statusIcon = STATUS_ICONS[member?.status || 'off-duty'];

    return (
      <LongPressGestureHandler
        key={member?.id}
        onHandlerStateChange={(event) => handleLongPress(event, member)}
        minDurationMs={500}
      >
        <TouchableOpacity
          style={styles.teamCard}
          onPress={() => handleCardPress(member)}
          activeOpacity={0.7}
          testID={`team-card-${member?.id}`}
          accessibilityLabel={`Team member ${member?.name || 'Unknown'}`}
        >
          <View style={styles.teamCardHeader}>
            <View style={[styles.avatar, { backgroundColor: statusColor }]}>
              <Text style={styles.avatarText}>
                {getAvatarInitials(member?.name)}
              </Text>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: statusColor }]}
              testID={`status-badge-${member?.id}`}
            >
              <Ionicons name={statusIcon} size={12} color="#fff" />
            </View>
          </View>

          <Text style={styles.teamName} numberOfLines={1} testID={`team-name-${member?.id}`}>
            {member?.name || 'Unknown'}
          </Text>
          <Text style={styles.teamRole} numberOfLines={1} testID={`team-role-${member?.id}`}>
            {member?.role || 'Firefighter'}
          </Text>

          <View style={styles.teamCardDivider} />

          {incident ? (
            <View style={styles.assignmentView} testID={`assignment-view-${member?.id}`}>
              <View style={styles.assignmentHeader}>
                <Ionicons name="flame" size={14} color="#ff4500" />
                <Text style={styles.assignmentLabel}>Current Assignment</Text>
              </View>
              <Text style={styles.assignmentTitle} numberOfLines={2}>
                {incident.title || 'Untitled Incident'}
              </Text>
              <View style={styles.assignmentFooter}>
                <Ionicons name="location" size={12} color="#888" />
                <Text style={styles.assignmentLocation} numberOfLines={1}>
                  {incident.address || 'Unknown location'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noAssignmentView} testID={`no-assignment-view-${member?.id}`}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
              <Text style={styles.noAssignmentText}>No active assignment</Text>
            </View>
          )}

          <View style={styles.teamCardFooter}>
            <Ionicons name="time-outline" size={12} color="#666" />
            <Text style={styles.lastUpdateText} testID={`last-update-${member?.id}`}>
              {formatLastUpdate(member?.lastUpdate)}
            </Text>
          </View>
        </TouchableOpacity>
      </LongPressGestureHandler>
    );
  };

  const renderTeamGrid = () => {
    if (filteredTeam.length === 0) {
      return (
        <View style={styles.emptyState} testID="empty-state">
          <Ionicons name="people-outline" size={64} color="#333" />
          <Text style={styles.emptyStateTitle}>No Team Members</Text>
          <Text style={styles.emptyStateText}>
            {selectedStatus === 'all'
              ? 'No team members found'
              : `No team members with status "${selectedStatus}"`}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.teamGrid} testID="team-grid">
        {filteredTeam.map((member) => renderTeamMemberCard(member))}
      </View>
    );
  };

  const renderContactModal = () => {
    if (!selectedMember) return null;

    return (
      <Modal
        visible={showContactModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
        testID="contact-modal"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowContactModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalAvatar}>
                <Text style={styles.modalAvatarText}>
                  {getAvatarInitials(selectedMember.name)}
                </Text>
              </View>
              <Text style={styles.modalName}>{selectedMember.name || 'Unknown'}</Text>
              <Text style={styles.modalRole}>{selectedMember.role || 'Firefighter'}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={handleCall}
                testID="contact-call-button"
                accessibilityLabel="Call team member"
              >
                <LinearGradient
                  colors={['#4CAF50', '#45a049']}
                  style={styles.modalActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="call" size={24} color="#fff" />
                  <Text style={styles.modalActionText}>Call</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={handleMessage}
                testID="contact-message-button"
                accessibilityLabel="Message team member"
              >
                <LinearGradient
                  colors={['#2196F3', '#1976D2']}
                  style={styles.modalActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="chatbubble" size={24} color="#fff" />
                  <Text style={styles.modalActionText}>Message</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={handleViewDetails}
                testID="contact-details-button"
                accessibilityLabel="View team member details"
              >
                <LinearGradient
                  colors={['#ff4500', '#ff6b00']}
                  style={styles.modalActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="information-circle" size={24} color="#fff" />
                  <Text style={styles.modalActionText}>Details</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowContactModal(false)}
              testID="contact-modal-close"
              accessibilityLabel="Close contact options"
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStatsHeader()}
        {renderStatusFilters()}
        {renderTeamGrid()}
      </ScrollView>
      {renderContactModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
    textAlign: 'center',
  },
  filterScrollView: {
    flexGrow: 0,
    marginTop: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  filterChipSelected: {
    backgroundColor: '#ff4500',
    borderColor: '#ff4500',
  },
  filterChipText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  filterChipBadge: {
    backgroundColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  filterChipBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterChipBadgeText: {
    fontSize: 12,
    color: '#888',
    fontWeight: 'bold',
  },
  filterChipBadgeTextSelected: {
    color: '#fff',
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  teamCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  teamCardHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: CARD_WIDTH / 2 - 42,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f5f5f5',
    textAlign: 'center',
    marginBottom: 4,
  },
  teamRole: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  teamCardDivider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 12,
  },
  assignmentView: {
    marginBottom: 12,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  assignmentLabel: {
    fontSize: 11,
    color: '#ff4500',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  assignmentTitle: {
    fontSize: 13,
    color: '#f5f5f5',
    fontWeight: '600',
    marginBottom: 6,
  },
  assignmentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignmentLocation: {
    fontSize: 11,
    color: '#888',
    flex: 1,
  },
  noAssignmentView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  noAssignmentText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  teamCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  lastUpdateText: {
    fontSize: 11,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f5f5f5',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff4500',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f5f5f5',
    marginBottom: 4,
  },
  modalRole: {
    fontSize: 14,
    color: '#888',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modalActionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalActionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
});
