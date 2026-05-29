import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  Animated,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { format, formatDistanceToNow, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Swipeable } from 'react-native-gesture-handler';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

const CATEGORY_ICONS = {
  'Food': 'restaurant-outline',
  'Transportation': 'car-outline',
  'Utilities': 'flash-outline',
  'Entertainment': 'game-controller-outline',
  'Accommodation': 'bed-outline',
  'Shopping': 'cart-outline',
  'Other': 'ellipsis-horizontal-outline',
};

const CATEGORY_COLORS = {
  'Food': '#FF6B6B',
  'Transportation': '#4ECDC4',
  'Utilities': '#95E1D3',
  'Entertainment': '#F38181',
  'Accommodation': '#AA96DA',
  'Shopping': '#FCBAD3',
  'Other': '#757575',
};

const CATEGORIES = [
  'All',
  'Food',
  'Transportation',
  'Utilities',
  'Entertainment',
  'Accommodation',
  'Shopping',
  'Other',
];

export default function Expenses({ navigation }) {
  const {
    expenses,
    groups,
    members,
    deleteExpense,
    updateExpense,
  } = useSettleSnap();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState(null);
  const [dateRangeEnd, setDateRangeEnd] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filteredExpenses = useMemo(() => {
    let filtered = expenses || [];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(exp =>
        (exp?.description || '').toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(exp => exp?.category === selectedCategory);
    }

    if (selectedGroup !== 'All') {
      filtered = filtered.filter(exp => exp?.groupId === selectedGroup);
    }

    if (dateRangeStart && dateRangeEnd) {
      const start = startOfDay(dateRangeStart);
      const end = endOfDay(dateRangeEnd);
      filtered = filtered.filter(exp => {
        const expDate = new Date(exp?.date || exp?.createdAt || Date.now());
        const safeDate = isNaN(expDate.getTime()) ? new Date() : expDate;
        return isWithinInterval(safeDate, { start, end });
      });
    }

    return filtered.sort((a, b) => {
      const dateA = a?.date || a?.createdAt || 0;
      const dateB = b?.date || b?.createdAt || 0;
      return dateB - dateA;
    });
  }, [expenses, searchQuery, selectedCategory, selectedGroup, dateRangeStart, dateRangeEnd]);

  const groupedExpenses = useMemo(() => {
    const grouped = {};

    (filteredExpenses || []).forEach(expense => {
      const expDate = new Date(expense?.date || expense?.createdAt || Date.now());
      const safeDate = isNaN(expDate.getTime()) ? new Date() : expDate;
      const dateKey = format(safeDate, 'yyyy-MM-dd');
      const displayDate = format(safeDate, 'MMMM d, yyyy');

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          title: displayDate,
          data: [],
        };
      }

      grouped[dateKey].data.push(expense);
    });

    return Object.values(grouped).sort((a, b) => {
      const dateA = new Date(a.data[0]?.date || a.data[0]?.createdAt || 0);
      const dateB = new Date(b.data[0]?.date || b.data[0]?.createdAt || 0);
      return dateB - dateA;
    });
  }, [filteredExpenses]);

  const getMemberName = (memberId) => {
    const member = (members || []).find(m => m?.id === memberId);
    return member?.name || 'Unknown';
  };

  const getGroupName = (groupId) => {
    const group = (groups || []).find(g => g?.id === groupId);
    return group?.name || 'Unknown Group';
  };

  const handleExpensePress = (expense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedExpense(expense);
    setShowDetailModal(true);
  };

  const handleDeleteExpense = (expenseId) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteExpense(expenseId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleEditExpense = (expense) => {
    setShowDetailModal(false);
    navigation.navigate('AddExpense', { expense, groupId: expense?.groupId });
  };

  const renderRightActions = (progress, dragX, expense) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.swipeActionsContainer}>
        <Animated.View style={[styles.swipeAction, { transform: [{ translateX: trans }] }]}>
          <TouchableOpacity
            style={[styles.swipeButton, styles.editButton]}
            onPress={() => handleEditExpense(expense)}
            testID={`edit-expense-${expense?.id}`}
            accessibilityLabel="Edit expense"
          >
            <Ionicons name="pencil" size={24} color="#FFFFFF" />
            <Text style={styles.swipeButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeButton, styles.deleteButton]}
            onPress={() => handleDeleteExpense(expense?.id)}
            testID={`delete-expense-${expense?.id}`}
            accessibilityLabel="Delete expense"
          >
            <Ionicons name="trash" size={24} color="#FFFFFF" />
            <Text style={styles.swipeButtonText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const renderExpenseCard = ({ item }) => {
    const category = item?.category || 'Other';
    const iconName = CATEGORY_ICONS[category] || 'ellipsis-horizontal-outline';
    const iconColor = CATEGORY_COLORS[category] || '#757575';
    const splitCount = (item?.splitWith || []).length;
    const payerName = getMemberName(item?.paidBy);
    const groupName = getGroupName(item?.groupId);

    return (
      <Swipeable
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
        overshootRight={false}
      >
        <TouchableOpacity
          style={styles.expenseCard}
          onPress={() => handleExpensePress(item)}
          testID={`expense-card-${item?.id}`}
          accessibilityLabel={`Expense ${item?.description}`}
          activeOpacity={0.7}
        >
          <View style={[styles.categoryIcon, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={iconName} size={24} color={iconColor} />
          </View>

          <View style={styles.expenseContent}>
            <Text style={styles.expenseDescription} numberOfLines={1}>
              {item?.description || 'Untitled Expense'}
            </Text>
            <View style={styles.expenseMetaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={14} color="#757575" />
                <Text style={styles.metaText}>{payerName}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={14} color="#757575" />
                <Text style={styles.metaText}>{splitCount} split</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="folder-outline" size={14} color="#757575" />
                <Text style={styles.metaText} numberOfLines={1}>{groupName}</Text>
              </View>
            </View>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountText}>${(item?.amount || 0).toFixed(2)}</Text>
            {item?.imageUri && (
              <Ionicons name="image-outline" size={16} color="#1B4332" style={styles.receiptIcon} />
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={80} color="#E0E0E0" />
      <Text style={styles.emptyStateTitle}>No Expenses Found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery || selectedCategory !== 'All' || selectedGroup !== 'All'
          ? 'Try adjusting your filters'
          : 'No paper trail yet. Let's go spend some money.'}
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddExpense')}
        testID="add-first-expense-button"
        accessibilityLabel="Add first expense"
      >
        <LinearGradient colors={['#2E7D32', '#1B5E20']} style={styles.gradientButton}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Expense</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedGroup('All');
    setDateRangeStart(null);
    setDateRangeEnd(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'All') count++;
    if (selectedGroup !== 'All') count++;
    if (dateRangeStart && dateRangeEnd) count++;
    return count;
  }, [selectedCategory, selectedGroup, dateRangeStart, dateRangeEnd]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2E7D32', '#1B5E20']} style={styles.header}>
        <Text style={styles.headerTitle}>Expenses</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#757575" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search the paper trail..."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="expense-search-input"
            accessibilityLabel="Search expenses"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              testID="clear-search-button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color="#757575" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterChipsContainer}
        contentContainerStyle={styles.filterChipsContent}
      >
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowFilterModal(true);
          }}
          testID="open-filter-modal-button"
          accessibilityLabel="Open filters"
        >
          <Ionicons name="filter-outline" size={18} color="#2E7D32" />
          <Text style={styles.filterButtonText}>Filters</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedCategory(category);
            }}
            testID={`category-chip-${category}`}
            accessibilityLabel={`Filter by ${category}`}
          >
            {category !== 'All' && (
              <Ionicons
                name={CATEGORY_ICONS[category]}
                size={16}
                color={selectedCategory === category ? '#FFFFFF' : '#757575'}
                style={styles.chipIcon}
              />
            )}
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}

        {activeFilterCount > 0 && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={clearFilters}
            testID="clear-filters-button"
            accessibilityLabel="Clear all filters"
          >
            <Ionicons name="close-circle-outline" size={18} color="#D32F2F" />
            <Text style={styles.clearFiltersText}>Clear</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <SectionList
        sections={groupedExpenses}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        renderItem={renderExpenseCard}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={[
          styles.listContent,
          groupedExpenses.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        stickySectionHeadersEnabled={true}
        testID="expenses-section-list"
      />

      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter & Sort</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                testID="close-filter-modal-button"
                accessibilityLabel="Close filter modal"
              >
                <Ionicons name="close" size={28} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterModalScroll}>
              <Text style={styles.filterSectionTitle}>Group</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    selectedGroup === 'All' && styles.filterOptionActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedGroup('All');
                  }}
                  testID="filter-group-all"
                  accessibilityLabel="Filter all groups"
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedGroup === 'All' && styles.filterOptionTextActive,
                    ]}
                  >
                    All Groups
                  </Text>
                  {selectedGroup === 'All' && (
                    <Ionicons name="checkmark" size={20} color="#2E7D32" />
                  )}
                </TouchableOpacity>

                {(groups || []).map((group) => (
                  <TouchableOpacity
                    key={group?.id}
                    style={[
                      styles.filterOption,
                      selectedGroup === group?.id && styles.filterOptionActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedGroup(group?.id);
                    }}
                    testID={`filter-group-${group?.id}`}
                    accessibilityLabel={`Filter by group ${group?.name}`}
                  >
                    <View style={styles.filterOptionContent}>
                      <View
                        style={[styles.groupColorDot, { backgroundColor: group?.color || '#757575' }]}
                      />
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedGroup === group?.id && styles.filterOptionTextActive,
                        ]}
                      >
                        {group?.name || 'Unnamed Group'}
                      </Text>
                    </View>
                    {selectedGroup === group?.id && (
                      <Ionicons name="checkmark" size={20} color="#2E7D32" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterSectionTitle}>Date Range</Text>
              <View style={styles.dateRangeContainer}>
                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDateRangeStart(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
                    setDateRangeEnd(new Date());
                  }}
                  testID="date-range-week-button"
                  accessibilityLabel="Filter last 7 days"
                >
                  <Text style={styles.dateRangeButtonText}>Last 7 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDateRangeStart(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
                    setDateRangeEnd(new Date());
                  }}
                  testID="date-range-month-button"
                  accessibilityLabel="Filter last 30 days"
                >
                  <Text style={styles.dateRangeButtonText}>Last 30 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDateRangeStart(null);
                    setDateRangeEnd(null);
                  }}
                  testID="date-range-clear-button"
                  accessibilityLabel="Clear date range"
                >
                  <Text style={styles.dateRangeButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.applyFiltersButton}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setShowFilterModal(false);
              }}
              testID="apply-filters-button"
              accessibilityLabel="Apply filters"
            >
              <LinearGradient colors={['#2E7D32', '#1B5E20']} style={styles.gradientButton}>
                <Text style={styles.applyFiltersButtonText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Expense Details</Text>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}
                testID="close-detail-modal-button"
                accessibilityLabel="Close detail modal"
              >
                <Ionicons name="close" size={28} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailModalScroll}>
              {selectedExpense?.imageUri && (
                <Image
                  source={{ uri: selectedExpense.imageUri }}
                  style={styles.receiptImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailValue}>
                  {selectedExpense?.description || 'Untitled Expense'}
                </Text>
              </View>

              <View style={styles.detailSection}>