import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatDistanceToNow, format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64;
const CHART_HEIGHT = 180;

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

const FILTER_TYPES = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'expenses', label: 'Expenses', icon: 'cash-outline' },
  { id: 'settlements', label: 'Settlements', icon: 'checkmark-circle-outline' },
];

export default function ActivityScreen({ navigation }) {
  const {
    groups,
    members,
    expenses,
    settlements,
    recentActivity,
    monthlyStats,
  } = useSettleSnap();

  const [selectedFilterType, setSelectedFilterType] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [exporting, setExporting] = useState(false);

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

    if (selectedFilterType !== 'all') {
      filtered = filtered.filter(activity => activity?.type === selectedFilterType);
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
  }, [allActivities, selectedFilterType, selectedGroup]);

  const groupedActivities = useMemo(() => {
    const grouped = {};

    (filteredActivities || []).forEach(activity => {
      const timestamp = activity?.timestamp || Date.now();
      const activityDate = new Date(timestamp);
      const safeDate = isNaN(activityDate.getTime()) ? new Date() : activityDate;
      const dateKey = format(safeDate, 'yyyy-MM-dd');

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: safeDate,
          activities: [],
        };
      }

      grouped[dateKey].activities.push(activity);
    });

    return Object.values(grouped).sort((a, b) => b.date - a.date);
  }, [filteredActivities]);

  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    const currentMonth = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    (expenses || []).forEach(expense => {
      const expenseDate = new Date(expense?.createdAt || Date.now());
      const safeDate = isNaN(expenseDate.getTime()) ? new Date() : expenseDate;

      if (isWithinInterval(safeDate, { start: monthStart, end: monthEnd })) {
        const category = expense?.category || 'Other';
        const amount = expense?.amount || 0;

        if (!breakdown[category]) {
          breakdown[category] = 0;
        }

        breakdown[category] += amount;
      }
    });

    return breakdown;
  }, [expenses]);

  const totalMonthlySpending = useMemo(() => {
    return Object.values(categoryBreakdown).reduce((sum, amount) => sum + amount, 0);
  }, [categoryBreakdown]);

  const chartData = useMemo(() => {
    const categories = Object.keys(categoryBreakdown);
    if (categories.length === 0) return [];

    const maxAmount = Math.max(...Object.values(categoryBreakdown));
    const barWidth = (CHART_WIDTH - (categories.length - 1) * 12) / categories.length;

    return categories.map((category, index) => {
      const amount = categoryBreakdown[category];
      const height = maxAmount > 0 ? (amount / maxAmount) * (CHART_HEIGHT - 40) : 0;
      const x = index * (barWidth + 12);
      const y = CHART_HEIGHT - height - 20;

      return {
        category,
        amount,
        x,
        y,
        width: barWidth,
        height,
        color: CATEGORY_COLORS[category] || '#757575',
      };
    });
  }, [categoryBreakdown]);

  const handleFilterTypePress = (filterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilterType(filterType);
  };

  const handleGroupFilterPress = (groupId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGroup(groupId);
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const csvHeader = 'Date,Type,Description,Amount,Group,Category\n';
      const csvRows = (filteredActivities || []).map(activity => {
        const timestamp = activity?.timestamp || Date.now();
        const activityDate = new Date(timestamp);
        const safeDate = isNaN(activityDate.getTime()) ? new Date() : activityDate;
        const dateStr = format(safeDate, 'yyyy-MM-dd HH:mm:ss');

        if (activity?.type === 'expense') {
          const expense = activity?.data;
          const group = (groups || []).find(g => g?.id === expense?.groupId);
          return `${dateStr},Expense,"${expense?.description || ''}",${expense?.amount || 0},"${group?.name || ''}","${expense?.category || ''}"`;
        } else if (activity?.type === 'settlement') {
          const settlement = activity?.data;
          const group = (groups || []).find(g => g?.id === settlement?.groupId);
          const fromMember = (members || []).find(m => m?.id === settlement?.from);
          const toMember = (members || []).find(m => m?.id === settlement?.to);
          return `${dateStr},Settlement,"${fromMember?.name || ''} paid ${toMember?.name || ''}",${settlement?.amount || 0},"${group?.name || ''}",Settlement`;
        }
        return '';
      }).join('\n');

      const csvContent = csvHeader + csvRows;
      const fileUri = FileSystem.documentDirectory + 'activity_export.csv';

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Activity Data',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Success', 'Activity data exported to ' + fileUri);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export activity data');
    } finally {
      setExporting(false);
    }
  };

  const renderSpendingChart = () => {
    if (chartData.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <Ionicons name="bar-chart-outline" size={48} color="#CBD5E0" />
          <Text style={styles.emptyChartText}>No spending data this month</Text>
        </View>
      );
    }

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Monthly Spending</Text>
          <Text style={styles.chartAmount}>${totalMonthlySpending.toFixed(2)}</Text>
        </View>

        <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={styles.chart}>
          <Line
            x1={0}
            y1={CHART_HEIGHT - 20}
            x2={CHART_WIDTH}
            y2={CHART_HEIGHT - 20}
            stroke="#E2E8F0"
            strokeWidth={1}
          />

          {chartData.map((bar, index) => (
            <React.Fragment key={index}>
              <Rect
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill={bar.color}
                rx={4}
              />
              <SvgText
                x={bar.x + bar.width / 2}
                y={CHART_HEIGHT - 4}
                fontSize={10}
                fill="#718096"
                textAnchor="middle"
              >
                {bar.category.slice(0, 3)}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>

        <View style={styles.legendContainer}>
          {chartData.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>
                {item.category} ${item.amount.toFixed(0)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderFilterChips = () => {
    return (
      <View style={styles.filtersSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContainer}
        >
          {FILTER_TYPES.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                selectedFilterType === filter.id && styles.filterChipActive,
              ]}
              onPress={() => handleFilterTypePress(filter.id)}
              testID={`filter-type-${filter.id}`}
              accessibilityLabel={`Filter by ${filter.label}`}
            >
              <Ionicons
                name={filter.icon}
                size={16}
                color={selectedFilterType === filter.id ? '#FFFFFF' : '#4A5568'}
              />
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilterType === filter.id && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.filterDivider} />

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedGroup === 'all' && styles.filterChipActive,
            ]}
            onPress={() => handleGroupFilterPress('all')}
            testID="filter-group-all"
            accessibilityLabel="Show all groups"
          >
            <Ionicons
              name="apps-outline"
              size={16}
              color={selectedGroup === 'all' ? '#FFFFFF' : '#4A5568'}
            />
            <Text
              style={[
                styles.filterChipText,
                selectedGroup === 'all' && styles.filterChipTextActive,
              ]}
            >
              All Groups
            </Text>
          </TouchableOpacity>

          {(groups || []).map((group) => (
            <TouchableOpacity
              key={group?.id}
              style={[
                styles.filterChip,
                selectedGroup === group?.id && styles.filterChipActive,
              ]}
              onPress={() => handleGroupFilterPress(group?.id)}
              testID={`filter-group-${group?.id}`}
              accessibilityLabel={`Filter by ${group?.name}`}
            >
              <View
                style={[
                  styles.groupColorDot,
                  { backgroundColor: group?.color || '#757575' },
                ]}
              />
              <Text
                style={[
                  styles.filterChipText,
                  selectedGroup === group?.id && styles.filterChipTextActive,
                ]}
              >
                {group?.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderActivityItem = (activity) => {
    if (activity?.type === 'expense') {
      const expense = activity?.data;
      const group = (groups || []).find(g => g?.id === expense?.groupId);
      const paidByMember = (members || []).find(m => m?.id === expense?.paidBy);
      const category = expense?.category || 'Other';
      const icon = CATEGORY_ICONS[category] || 'ellipsis-horizontal-outline';
      const color = CATEGORY_COLORS[category] || '#757575';

      const timestamp = expense?.createdAt || Date.now();
      const expenseDate = new Date(timestamp);
      const safeDate = isNaN(expenseDate.getTime()) ? new Date() : expenseDate;

      return (
        <TouchableOpacity
          style={styles.activityItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          testID={`activity-expense-${expense?.id}`}
          accessibilityLabel={`Expense ${expense?.description}`}
        >
          <View style={[styles.activityIcon, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={24} color={color} />
          </View>

          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>{expense?.description || 'Expense'}</Text>
            <View style={styles.activityMeta}>
              <Ionicons name="person-outline" size={12} color="#718096" />
              <Text style={styles.activityMetaText}>
                {paidByMember?.name || 'Unknown'}
              </Text>
              {group && (
                <>
                  <Text style={styles.activityMetaDot}>•</Text>
                  <Text style={styles.activityMetaText}>{group?.name}</Text>
                </>
              )}
            </View>
            <Text style={styles.activityTime}>
              {formatDistanceToNow(safeDate, { addSuffix: true })}
            </Text>
          </View>

          <View style={styles.activityAmount}>
            <Text style={styles.activityAmountText}>
              ${(expense?.amount || 0).toFixed(2)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    } else if (activity?.type === 'settlement') {
      const settlement = activity?.data;
      const group = (groups || []).find(g => g?.id === settlement?.groupId);
      const fromMember = (members || []).find(m => m?.id === settlement?.from);
      const toMember = (members || []).find(m => m?.id === settlement?.to);

      const timestamp = settlement?.settledAt || Date.now();
      const settlementDate = new Date(timestamp);
      const safeDate = isNaN(settlementDate.getTime()) ? new Date() : settlementDate;

      return (
        <TouchableOpacity
          style={styles.activityItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          testID={`activity-settlement-${settlement?.id}`}
          accessibilityLabel={`Settlement from ${fromMember?.name} to ${toMember?.name}`}
        >
          <View style={[styles.activityIcon, { backgroundColor: '#48BB7820' }]}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#48BB78" />
          </View>

          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Payment Settled</Text>
            <View style={styles.activityMeta}>
              <Text style={styles.activityMetaText}>
                {fromMember?.name || 'Unknown'} → {toMember?.name || 'Unknown'}
              </Text>
              {group && (
                <>
                  <Text style={styles.activityMetaDot}>•</Text>
                  <Text style={styles.activityMetaText}>{group?.name}</Text>
                </>
              )}
            </View>
            <Text style={styles.activityTime}>
              {formatDistanceToNow(safeDate, { addSuffix: true })}
            </Text>
          </View>

          <View style={styles.activityAmount}>
            <Text style={[styles.activityAmountText, { color: '#48BB78' }]}>
              ${(settlement?.amount || 0).toFixed(2)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderDateSection = ({ item }) => {
    const sectionDate = item?.date || new Date();
    const safeDate = isNaN(sectionDate.getTime()) ? new Date() : sectionDate;

    return (
      <View style={styles.dateSection}>
        <View style={styles.dateSectionHeader}>
          <Text style={styles.dateSectionTitle}>
            {format(safeDate, 'EEEE, MMMM d, yyyy')}
          </Text>
          <View style={styles.dateSectionLine} />
        </View>

        {(item?.activities || []).map((activity, index) => (
          <View key={activity?.id || index}>
            {renderActivityItem(activity)}
          </View>
        ))}
      </View>
    );
  };

  if (!groups || !members || !expenses) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2D3748" />
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
        {renderSpendingChart()}

        <View style={styles.exportSection}>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportData}
            disabled={exporting}
            testID="export-data-button"
            accessibilityLabel="Export activity data"
          >
            <LinearGradient
              colors={['#2D3748', '#1A202C']}
              style={styles.exportButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.exportButtonText}>Export CSV</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {renderFilterChips()}

        {groupedActivities.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="time-outline" size={80} color="#CBD5E0" />
            <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
            <Text style={styles.emptyStateText}>
              Your expenses and settlements will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={groupedActivities}
            renderItem={renderDateSection}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.activityList}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  chartAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D3748',
  },
  chart: {
    marginBottom: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
  emptyChartContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyChartText: {
    fontSize: 14,
    color: '#A0AEC0',
    marginTop: 12,
    fontWeight: '500',
  },
  exportSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  exportButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  exportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filtersSection: {
    marginBottom: 16,
  },
  filterChipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#2D3748',
    borderColor: '#2D3748',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  groupColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityList: {
    paddingHorizontal: 16,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  dateSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A5568',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateSectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityMetaText: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
  },
  activityMetaDot: {
    fontSize: 13,
    color: '#CBD5E0',
    marginHorizontal: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#A0AEC0',
    fontWeight: '500',
  },
  activityAmount: {
    alignItems: 'flex-end',
  },
  activityAmountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A5568',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#A0AEC0',
    textAlign: 'center',
    lineHeight: 20,
  },
});
