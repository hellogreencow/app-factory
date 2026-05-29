import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { useFireFight } from '../context/FireFightContext';

const { width } = Dimensions.get('window');

const SEVERITY_COLORS = {
  low: '#4CAF50',
  medium: '#FFA500',
  high: '#FF6B00',
  critical: '#FF0000',
};

const SEVERITY_GRADIENTS = {
  low: ['#4CAF50', '#45a049'],
  medium: ['#FFA500', '#ff8c00'],
  high: ['#FF6B00', '#ff5500'],
  critical: ['#FF0000', '#cc0000'],
};

const STATUS_COLORS = {
  active: '#2196F3',
  resolved: '#4CAF50',
  archived: '#757575',
};

const SEVERITY_ICONS = {
  low: 'alert-circle-outline',
  medium: 'warning-outline',
  high: 'flame-outline',
  critical: 'nuclear-outline',
};

export default function IncidentList({ navigation }) {
  const {
    incidents,
    activeIncidents,
    resolvedIncidents,
    updateIncident,
  } = useFireFight();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('active');
  const [selectedSeverities, setSelectedSeverities] = useState({
    low: true,
    medium: true,
    high: true,
    critical: true,
  });

  const swipeableRefs = useRef({});

  const statusCounts = useMemo(() => {
    const allIncidents = incidents || [];
    return {
      active: allIncidents.filter(i => i?.status === 'active').length,
      resolved: allIncidents.filter(i => i?.status === 'resolved').length,
      archived: allIncidents.filter(i => i?.status === 'archived').length,
    };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    let filtered = [];

    if (selectedTab === 'active') {
      filtered = activeIncidents || [];
    } else if (selectedTab === 'resolved') {
      filtered = resolvedIncidents || [];
    } else {
      filtered = (incidents || []).filter(i => i?.status === 'archived');
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(incident => {
        const title = incident?.title?.toLowerCase() || '';
        const address = incident?.address?.toLowerCase() || '';
        const assignedTeam = (incident?.assignedTeam || []).join(' ').toLowerCase();
        return title.includes(query) || address.includes(query) || assignedTeam.includes(query);
      });
    }

    filtered = filtered.filter(incident => {
      const severity = incident?.severity || 'low';
      return selectedSeverities[severity] === true;
    });

    return filtered.sort((a, b) => {
      const timeA = a?.createdAt || 0;
      const timeB = b?.createdAt || 0;
      return timeB - timeA;
    });
  }, [incidents, activeIncidents, resolvedIncidents, selectedTab, searchQuery, selectedSeverities]);

  const toggleSeverityFilter = (severity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSeverities(prev => ({
      ...prev,
      [severity]: !prev[severity],
    }));
  };

  const handleTabChange = (tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTab(tab);
  };

  const handleStatusUpdate = async (incident, newStatus) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateIncident(incident?.id, { status: newStatus, updatedAt: Date.now() });
      
      const refKey = incident?.id;
      if (swipeableRefs.current[refKey]) {
        swipeableRefs.current[refKey].close();
      }
    } catch (error) {
      console.error('Error updating incident status:', error);
      Alert.alert('Error', 'Failed to update incident status');
    }
  };

  const handleArchive = async (incident) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Archive Incident',
        'Are you sure you want to archive this incident?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            style: 'destructive',
            onPress: async () => {
              await updateIncident(incident?.id, { status: 'archived', updatedAt: Date.now() });
              const refKey = incident?.id;
              if (swipeableRefs.current[refKey]) {
                swipeableRefs.current[refKey].close();
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error archiving incident:', error);
    }
  };

  const renderRightActions = (incident) => {
    const isActive = incident?.status === 'active';
    const isResolved = incident?.status === 'resolved';

    return (
      <View style={styles.swipeActionsContainer}>
        {isActive && (
          <TouchableOpacity
            style={[styles.swipeAction, { backgroundColor: '#4CAF50' }]}
            onPress={() => handleStatusUpdate(incident, 'resolved')}
            testID={`swipe-resolve-${incident?.id}`}
            accessibilityLabel="Mark incident as resolved"
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.swipeActionText}>Resolve</Text>
          </TouchableOpacity>
        )}
        {isResolved && (
          <TouchableOpacity
            style={[styles.swipeAction, { backgroundColor: '#2196F3' }]}
            onPress={() => handleStatusUpdate(incident, 'active')}
            testID={`swipe-reopen-${incident?.id}`}
            accessibilityLabel="Reopen incident"
          >
            <Ionicons name="refresh-circle" size={24} color="#fff" />
            <Text style={styles.swipeActionText}>Reopen</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: '#757575' }]}
          onPress={() => handleArchive(incident)}
          testID={`swipe-archive-${incident?.id}`}
          accessibilityLabel="Archive incident"
        >
          <Ionicons name="archive" size={24} color="#fff" />
          <Text style={styles.swipeActionText}>Archive</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderIncidentCard = (incident) => {
    const severity = incident?.severity || 'low';
    const status = incident?.status || 'active';
    const title = incident?.title || 'Untitled Incident';
    const address = incident?.address || 'Unknown location';
    const createdAt = incident?.createdAt || Date.now();
    const assignedTeam = incident?.assignedTeam || [];

    const createdDate = new Date(createdAt);
    const safeCreatedDate = isNaN(createdDate.getTime()) ? new Date() : createdDate;
    const timeAgo = formatDistanceToNow(safeCreatedDate, { addSuffix: true });

    return (
      <Swipeable
        key={incident?.id}
        ref={(ref) => {
          if (ref && incident?.id) {
            swipeableRefs.current[incident.id] = ref;
          }
        }}
        renderRightActions={() => renderRightActions(incident)}
        overshootRight={false}
        friction={2}
        testID={`swipeable-${incident?.id}`}
      >
        <TouchableOpacity
          style={styles.incidentCardWrapper}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('IncidentDetail', { incidentId: incident?.id });
          }}
          testID={`incident-card-${incident?.id}`}
          accessibilityLabel={`Incident: ${title}`}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={SEVERITY_GRADIENTS[severity]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.incidentCardGradient}
          >
            <View style={styles.incidentCardContent}>
              <View style={styles.incidentHeader}>
                <View style={styles.incidentTitleRow}>
                  <Ionicons
                    name={SEVERITY_ICONS[severity]}
                    size={24}
                    color="#fff"
                    style={styles.severityIcon}
                  />
                  <Text style={styles.incidentTitle} numberOfLines={1}>
                    {title}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] }]}>
                  <Text style={styles.statusBadgeText}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.incidentDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.detailText} numberOfLines={1}>
                    {address}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.detailText}>{timeAgo}</Text>
                </View>
                {assignedTeam.length > 0 && (
                  <View style={styles.detailRow}>
                    <Ionicons name="people" size={16} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.detailText}>
                      {assignedTeam.length} team member{assignedTeam.length !== 1 ? 's' : ''} assigned
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter active calls..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="search-input"
            accessibilityLabel="Search incidents by title, address, or team"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              testID="search-clear"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {Object.keys(SEVERITY_COLORS).map((severity) => {
          const isSelected = selectedSeverities[severity];
          return (
            <TouchableOpacity
              key={severity}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? SEVERITY_COLORS[severity] : '#1a1a1a',
                  borderColor: SEVERITY_COLORS[severity],
                  borderWidth: isSelected ? 0 : 1,
                },
              ]}
              onPress={() => toggleSeverityFilter(severity)}
              testID={`severity-filter-${severity}`}
              accessibilityLabel={`Filter ${severity} severity incidents`}
            >
              <Ionicons
                name={SEVERITY_ICONS[severity]}
                size={18}
                color={isSelected ? '#fff' : SEVERITY_COLORS[severity]}
                style={styles.filterChipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  { color: isSelected ? '#fff' : SEVERITY_COLORS[severity] },
                ]}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.tabsContainer}>
        {['active', 'resolved', 'archived'].map((tab) => {
          const isSelected = selectedTab === tab;
          const count = statusCounts[tab] || 0;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isSelected && styles.tabActive]}
              onPress={() => handleTabChange(tab)}
              testID={`status-tab-${tab}`}
              accessibilityLabel={`${tab} incidents tab, ${count} incidents`}
            >
              <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  { backgroundColor: isSelected ? '#ff4500' : '#333' },
                ]}
              >
                <Text style={styles.tabBadgeText}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.incidentList}
        contentContainerStyle={styles.incidentListContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredIncidents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color="#444" />
            <Text style={styles.emptyStateTitle}>No Incidents Found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery.trim()
                ? "All sectors currently clear."
                : `No ${selectedTab} incidents at this time`}
            </Text>
          </View>
        ) : (
          (filteredIncidents || []).map((incident) => renderIncidentCard(incident))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f5f5f5',
    fontSize: 16,
  },
  filterContainer: {
    maxHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterContent: {
    paddingRight: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipIcon: {
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  tabActive: {
    backgroundColor: '#1a1a1a',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  tabTextActive: {
    color: '#f5f5f5',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  incidentList: {
    flex: 1,
  },
  incidentListContent: {
    padding: 16,
  },
  incidentCardWrapper: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  incidentCardGradient: {
    borderRadius: 12,
  },
  incidentCardContent: {
    padding: 16,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  incidentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  severityIcon: {
    marginRight: 8,
  },
  incidentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  incidentDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    paddingHorizontal: 12,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
    paddingHorizontal: 32,
  },
});
