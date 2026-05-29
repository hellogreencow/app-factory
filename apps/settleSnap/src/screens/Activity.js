import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { format, formatDistanceToNow, startOfDay, isSameDay } from 'date-fns';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

const ACTIVITY_TYPES = [
  { id: 'all', label: 'All Activity', icon: 'apps-outline' },
  { id: 'expense', label: 'Expenses', icon: 'cash-outline' },
  { id: 'settlement', label: 'Settlements', icon: 'checkmark-circle-outline' },
];

const CATEGORY_ICONS = {
  'Food': 'restaurant-outline',
  'Transportation': 'car-outline',
  'Utilities': 'flash-outline',
  'Entertainment': 'game-controller-outline',
  'Accommodation': 'bed-outline',
  'Shopping': 'cart-outline',
  'Other': 'ellipsis-horizontal-outline',
};

export default function Activity({ navigation }) {
  const {
    groups,
    members,
    expenses,
    settlements,
  } = useSettleSnap();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const allActivities = useMemo(() => {
    const activities = [];

    (expenses || []).forEach(expense => {
      activities.push({
        id: expense?.id,
        type: 'expense',
        data: expense,
        timestamp: expense?.createdAt || Date.now(),
      });
    });

    (settlements || []).forEach(settlement => {
      activities.push({
        id: settlement?.id,
        type: 'settlement',
        data: settlement,
        timestamp: settlement?.settledAt || Date.now(),
      });
    });

    return activities.sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
  }, [expenses, settlements]);

  const filteredActivities = useMemo(() => {
    let filtered = allActivities;

    if (selectedType !== 'all') {
      filtered = filtered.filter(activity => activity?.type === selectedType);
    }

    if (selectedGroup !== 'all') {
      filtered = filtered.filter(activity => {
        if (activity?.type === 'expense') {
          return activity?.data?.groupId === selectedGroup;
        } else if (activity?.type === 'settlement') {
          return activity?.data?.groupId === selectedGroup;
        }
        return false;
      });
    }

    return filtered;
  }, [allActivities, selectedType, selectedGroup]);

  const groupedActivities = useMemo(() => {
    const sections = [];
    let currentDate = null;
    let currentSection = null;

    filteredActivities.forEach(activity => {
      const activityTimestamp = activity?.timestamp || Date.now();
      const activityDate = new Date(activityTimestamp);
      const safeDate = isNaN(activityDate.getTime()) ? new Date() : activityDate;
      const dayStart = startOfDay(safeDate);

      if (!currentDate || !isSameDay(currentDate, dayStart)) {
        currentDate = dayStart;
        currentSection = {
          title: format(dayStart, 'MMMM d, yyyy'),
          data: [],
        };
        sections.push(currentSection);
      }

      currentSection.data.push(activity);
    });

    return sections;
  }, [filteredActivities]);

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleTypeFilter = (typeId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(typeId);
  };

  const handleGroupFilter = (groupId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGroup(groupId);
    setShowFilterModal(false);
  };

  const getMemberName = (memberId) => {
    const member = (members || []).find(m => m?.id === memberId);
    return member?.name || 'Unknown';
  };

  const getGroupName = (groupId) => {
    const group = (groups || []).find(g => g?.id === groupId);
    return group?.name || 'Unknown Group';
  };

  const renderActivityItem = ({ item }) => {
    const isExpense = item?.type === 'expense';
    const data = item?.data || {};

    if (isExpense) {
      const paidByName = getMemberName(data?.paidBy);
      const groupName = getGroupName(data?.groupId);
      const category = data?.category || 'Other';
      const icon = CATEGORY_ICONS[category] || 'ellipsis-horizontal-outline';
      const timestamp = data?.createdAt || Date.now();
      const activityDate = new Date(timestamp);
      const safeDate = isNaN(activityDate.getTime()) ? new Date() : activityDate;

      return (
        <TouchableOpacity
          style={styles.activityItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          testID={`activity-expense-${item?.id}`}
          accessibilityLabel={`Expense ${data?.description} for ${data?.amount} dollars by ${paidByName}`}
        >
          <View style={[styles.activityIcon, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name={icon} size={24} color="#F57C00" />
          </View>
          <View style={styles.activityContent}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {data?.description || 'Expense'}
              </Text>
              <Text style={styles.activityAmount}>
                ${(data?.amount || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.activityMeta}>
              <Ionicons name="person-outline" size={12} color="#757575" />
              <Text style={styles.activityMetaText}>{paidByName}</Text>
              <Ionicons name="ellipse" size={4} color="#757575" style={styles.metaDot} />
              <Text style={styles.activityMetaText}>{groupName}</Text>
            </View>
            <Text style={styles.activityTime}>
              {formatDistanceToNow(safeDate, { addSuffix: true })}
            </Text>
          </View>
        </TouchableOpacity>
      );
    } else {
      const fromName = getMemberName(data?.fromId);
      const toName = getMemberName(data?.toId);
      const groupName = getGroupName(data?.groupId);
      const timestamp = data?.settledAt || Date.now();
      const activityDate = new Date(timestamp);
      const safeDate = isNaN(activityDate.getTime()) ? new Date() : activityDate;

      return (
        <TouchableOpacity
          style={styles.activityItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          testID={`activity-settlement-${item?.id}`}
          accessibilityLabel={`Settlement ${fromName} paid ${toName} ${data?.amount} dollars`}
        >
          <View style={[styles.activityIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
          </View>
          <View style={styles.activityContent}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                Payment Settled
              </Text>
              <Text style={[styles.activityAmount, { color: '#2E7D32' }]}>
                ${(data?.amount || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.activityMeta}>
              <Text style={styles.activityMetaText}>
                {fromName} → {toName}
              </Text>
              <Ionicons name="ellipse" size={4} color="#757575" style={styles.metaDot} />
              <Text style={styles.activityMetaText}>{groupName}</Text>
            </View>
            <Text style={styles.activityTime}>
              {formatDistanceToNow(safeDate, { addSuffix: true })}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="time-outline" size={80} color="#E0E0E0" />
      <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
      <Text style={styles.emptyStateText}>
        Your expenses and settlements will appear here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2E7D32', '#1B5E20']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Activity</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFilterModal(true);
            }}
            testID="filter-button"
            accessibilityLabel="Open filter options"
          >
            <Ionicons name="filter-outline" size={24} color="#FFFFFF" />
            {selectedGroup !== 'all' && (
              <View style={styles.filterBadge} />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.typeFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeFilterScroll}
        >
          {ACTIVITY_TYPES.map(type => {
            const isSelected = selectedType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeFilterChip,
                  isSelected && styles.typeFilterChipActive,
                ]}
                onPress={() => handleTypeFilter(type.id)}
                testID={`filter-type-${type.id}`}
                accessibilityLabel={`Filter by ${type.label}`}
              >
                <Ionicons
                  name={type.icon}
                  size={18}
                  color={isSelected ? '#FFFFFF' : '#757575'}
                />
                <Text
                  style={[
                    styles.typeFilterText,
                    isSelected && styles.typeFilterTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <SectionList
        sections={groupedActivities}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        renderItem={renderActivityItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={true}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2E7D32"
            colors={['#2E7D32']}
            testID="pull-refresh"
          />
        }
        testID="activity-list"
      />

      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Group</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                testID="close-filter-modal"
                accessibilityLabel="Close filter modal"
              >
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[
                  styles.groupFilterItem,
                  selectedGroup === 'all' && styles.groupFilterItemActive,
                ]}
                onPress={() => handleGroupFilter('all')}
                testID="filter-group-all"
                accessibilityLabel="Show all groups"
              >
                <Ionicons
                  name="apps-outline"
                  size={24}
                  color={selectedGroup === 'all' ? '#2E7D32' : '#757575'}
                />
                <Text
                  style={[
                    styles.groupFilterText,
                    selectedGroup === 'all' && styles.groupFilterTextActive,
                  ]}
                >
                  All Groups
                </Text>
                {selectedGroup === 'all' && (
                  <Ionicons name="checkmark" size={24} color="#2E7D32" />
                )}
              </TouchableOpacity>

              {(groups || []).map(group => {
                const isSelected = selectedGroup === group?.id;
                return (
                  <TouchableOpacity
                    key={group?.id}
                    style={[
                      styles.groupFilterItem,
                      isSelected && styles.groupFilterItemActive,
                    ]}
                    onPress={() => handleGroupFilter(group?.id)}
                    testID={`filter-group-${group?.id}`}
                    accessibilityLabel={`Filter by ${group?.name}`}
                  >
                    <View
                      style={[
                        styles.groupColorDot,
                        { backgroundColor: group?.color || '#2E7D32' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.groupFilterText,
                        isSelected && styles.groupFilterTextActive,
                      ]}
                    >
                      {group?.name || 'Unnamed Group'}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={24} color="#2E7D32" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
  },
  typeFilterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  typeFilterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  typeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    gap: 6,
  },
  typeFilterChipActive: {
    backgroundColor: '#2E7D32',
  },
  typeFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  typeFilterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
    textTransform: 'uppercase',
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 8,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityMetaText: {
    fontSize: 13,
    color: '#757575',
  },
  metaDot: {
    marginHorizontal: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#757575',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalScroll: {
    maxHeight: 400,
  },
  groupFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupFilterItemActive: {
    backgroundColor: '#F1F8F4',
  },
  groupColorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  groupFilterText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  groupFilterTextActive: {
    fontWeight: '600',
    color: '#2E7D32',
  },
});
