import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, format } from 'date-fns';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

const CATEGORY_ICONS = {
  'Food & Dining': 'restaurant-outline',
  'Transportation': 'car-outline',
  'Accommodation': 'bed-outline',
  'Entertainment': 'game-controller-outline',
  'Utilities': 'flash-outline',
  'Shopping': 'cart-outline',
  'Healthcare': 'medical-outline',
  'Other': 'ellipsis-horizontal-outline',
};

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route?.params || {};
  const {
    groups,
    expenses,
    members,
    settlements,
    groupBalances,
  } = useSettleSnap();

  const [selectedTab, setSelectedTab] = useState('expenses');

  const group = useMemo(() => {
    return (groups || []).find(g => g?.id === groupId);
  }, [groups, groupId]);

  const groupExpenses = useMemo(() => {
    return (expenses || [])
      .filter(exp => exp?.groupId === groupId)
      .sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
  }, [expenses, groupId]);

  const groupMembers = useMemo(() => {
    if (!group?.members) return [];
    return (group.members || [])
      .map(memberId => {
        const member = (members || []).find(m => m?.id === memberId);
        return member;
      })
      .filter(Boolean);
  }, [group, members]);

  const memberBalances = useMemo(() => {
    const balances = {};
    const memberIds = group?.members || [];

    memberIds.forEach(memberId => {
      balances[memberId] = { paid: 0, owed: 0, net: 0 };
    });

    (groupExpenses || []).forEach(expense => {
      const paidBy = expense?.paidBy;
      const splitWith = expense?.splitWith || [];
      const amount = expense?.amount || 0;
      const perPerson = splitWith.length > 0 ? amount / splitWith.length : 0;

      if (balances[paidBy]) {
        balances[paidBy].paid += amount;
      }

      splitWith.forEach(memberId => {
        if (balances[memberId]) {
          balances[memberId].owed += perPerson;
        }
      });
    });

    Object.keys(balances).forEach(memberId => {
      balances[memberId].net = balances[memberId].paid - balances[memberId].owed;
    });

    return balances;
  }, [groupExpenses, group]);

  const totalGroupExpenses = useMemo(() => {
    return (groupExpenses || []).reduce((sum, exp) => sum + (exp?.amount || 0), 0);
  }, [groupExpenses]);

  const debts = useMemo(() => {
    const debtList = [];
    const memberIds = Object.keys(memberBalances);

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const member1 = memberIds[i];
        const member2 = memberIds[j];
        const balance1 = memberBalances[member1]?.net || 0;
        const balance2 = memberBalances[member2]?.net || 0;

        if (balance1 > 0 && balance2 < 0) {
          const amount = Math.min(balance1, Math.abs(balance2));
          if (amount > 0.01) {
            debtList.push({ from: member2, to: member1, amount });
          }
        } else if (balance1 < 0 && balance2 > 0) {
          const amount = Math.min(Math.abs(balance1), balance2);
          if (amount > 0.01) {
            debtList.push({ from: member1, to: member2, amount });
          }
        }
      }
    }

    return debtList;
  }, [memberBalances]);

  const handleAddExpense = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Scan', { groupId });
  };

  const handleSettleUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Settlement', { groupId });
  };

  const handleExpensePress = (expense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ExpenseDetail', { expenseId: expense?.id });
  };

  const getMemberName = (memberId) => {
    const member = (members || []).find(m => m?.id === memberId);
    return member?.name || 'Unknown';
  };

  const getMemberAvatar = (memberId) => {
    const member = (members || []).find(m => m?.id === memberId);
    return member?.avatar || '👤';
  };

  const formatSafeDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = new Date(timestamp);
    const safeDate = isNaN(date.getTime()) ? new Date() : date;
    try {
      return formatDistanceToNow(safeDate, { addSuffix: true });
    } catch (error) {
      return format(safeDate, 'MMM d, yyyy');
    }
  };

  const renderExpenseItem = ({ item }) => {
    const categoryIcon = CATEGORY_ICONS[item?.category] || CATEGORY_ICONS['Other'];
    const paidByName = getMemberName(item?.paidBy);
    const splitCount = (item?.splitWith || []).length;

    return (
      <TouchableOpacity
        style={styles.expenseCard}
        onPress={() => handleExpensePress(item)}
        testID={`expense-item-${item?.id}`}
        accessibilityLabel={`Expense ${item?.description} for $${item?.amount?.toFixed(2)}`}
      >
        <View style={styles.expenseIconContainer}>
          <LinearGradient
            colors={[group?.color || '#2D3748', '#1A202C']}
            style={styles.expenseIconGradient}
          >
            <Ionicons name={categoryIcon} size={24} color="#FFFFFF" />
          </LinearGradient>
        </View>

        <View style={styles.expenseContent}>
          <Text style={styles.expenseDescription}>{item?.description || 'Untitled'}</Text>
          <View style={styles.expenseMetaRow}>
            <Text style={styles.expenseMeta}>
              Paid by {paidByName}
            </Text>
            <Text style={styles.expenseDot}>•</Text>
            <Text style={styles.expenseMeta}>
              Split {splitCount} {splitCount === 1 ? 'way' : 'ways'}
            </Text>
          </View>
          <Text style={styles.expenseDate}>{formatSafeDate(item?.createdAt)}</Text>
        </View>

        <View style={styles.expenseAmountContainer}>
          <Text style={styles.expenseAmount}>${(item?.amount || 0).toFixed(2)}</Text>
          <Ionicons name="chevron-forward-outline" size={20} color="#A0AEC0" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderMemberBalance = ({ item: memberId }) => {
    const member = (members || []).find(m => m?.id === memberId);
    const balance = memberBalances[memberId] || { paid: 0, owed: 0, net: 0 };
    const isPositive = balance.net > 0;
    const isNeutral = Math.abs(balance.net) < 0.01;

    return (
      <View style={styles.memberBalanceCard} testID={`member-balance-${memberId}`}>
        <View style={styles.memberBalanceHeader}>
          <View style={styles.memberAvatarContainer}>
            <Text style={styles.memberAvatar}>{member?.avatar || '👤'}</Text>
          </View>
          <Text style={styles.memberName} numberOfLines={1}>
            {member?.name || 'Unknown'}
          </Text>
        </View>

        <View style={styles.memberBalanceBody}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Paid</Text>
            <Text style={styles.balanceValue}>${balance.paid.toFixed(2)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Owes</Text>
            <Text style={styles.balanceValue}>${balance.owed.toFixed(2)}</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceRow}>
            <Text style={styles.balanceNetLabel}>
              {isNeutral ? 'Settled' : isPositive ? 'Gets back' : 'Owes'}
            </Text>
            <Text
              style={[
                styles.balanceNetValue,
                isPositive && styles.balancePositive,
                !isPositive && !isNeutral && styles.balanceNegative,
                isNeutral && styles.balanceNeutral,
              ]}
            >
              ${Math.abs(balance.net).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDebtItem = ({ item }) => {
    const fromMember = (members || []).find(m => m?.id === item?.from);
    const toMember = (members || []).find(m => m?.id === item?.to);

    return (
      <View style={styles.debtCard} testID={`debt-item-${item?.from}-${item?.to}`}>
        <View style={styles.debtFlow}>
          <View style={styles.debtMemberContainer}>
            <Text style={styles.debtAvatar}>{fromMember?.avatar || '👤'}</Text>
            <Text style={styles.debtMemberName} numberOfLines={1}>
              {fromMember?.name || 'Unknown'}
            </Text>
          </View>

          <View style={styles.debtArrowContainer}>
            <Ionicons name="arrow-forward" size={24} color="#2D3748" />
            <Text style={styles.debtAmount}>${(item?.amount || 0).toFixed(2)}</Text>
          </View>

          <View style={styles.debtMemberContainer}>
            <Text style={styles.debtAvatar}>{toMember?.avatar || '👤'}</Text>
            <Text style={styles.debtMemberName} numberOfLines={1}>
              {toMember?.name || 'Unknown'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyExpenses = () => (
    <View style={styles.emptyState} testID="empty-expenses-state">
      <Ionicons name="receipt-outline" size={80} color="#CBD5E0" />
      <Text style={styles.emptyStateTitle}>No Expenses Yet</Text>
      <Text style={styles.emptyStateText}>
        Add your first expense to start tracking group spending
      </Text>
    </View>
  );

  const renderEmptyBalances = () => (
    <View style={styles.emptyState} testID="empty-balances-state">
      <Ionicons name="checkmark-circle-outline" size={80} color="#48BB78" />
      <Text style={styles.emptyStateTitle}>All Settled Up!</Text>
      <Text style={styles.emptyStateText}>
        No outstanding balances in this group
      </Text>
    </View>
  );

  if (!group) {
    return (
      <View style={styles.container}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={80} color="#F56565" />
          <Text style={styles.errorTitle}>Group Not Found</Text>
          <Text style={styles.errorText}>This group may have been deleted</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[group?.color || '#2D3748', '#1A202C']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            testID="back-button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.groupName}>{group?.name || 'Unnamed Group'}</Text>
            <Text style={styles.groupMeta}>
              {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'} • ${totalGroupExpenses.toFixed(2)} total
            </Text>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            testID="group-settings-button"
            accessibilityLabel="Group settings"
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'expenses' && styles.tabActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedTab('expenses');
          }}
          testID="tab-expenses"
          accessibilityLabel="Expenses tab"
        >
          <Ionicons
            name="receipt-outline"
            size={20}
            color={selectedTab === 'expenses' ? '#2D3748' : '#A0AEC0'}
          />
          <Text
            style={[styles.tabText, selectedTab === 'expenses' && styles.tabTextActive]}
          >
            Expenses
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'balances' && styles.tabActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedTab('balances');
          }}
          testID="tab-balances"
          accessibilityLabel="Balances tab"
        >
          <Ionicons
            name="analytics-outline"
            size={20}
            color={selectedTab === 'balances' ? '#2D3748' : '#A0AEC0'}
          />
          <Text
            style={[styles.tabText, selectedTab === 'balances' && styles.tabTextActive]}
          >
            Balances
          </Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'expenses' && (
        <FlatList
          data={groupExpenses}
          renderItem={renderExpenseItem}
          keyExtractor={(item) => item?.id || Math.random().toString()}
          contentContainerStyle={styles.expenseList}
          ListEmptyComponent={renderEmptyExpenses}
          showsVerticalScrollIndicator={false}
          testID="expense-list"
        />
      )}

      {selectedTab === 'balances' && (
        <ScrollView
          style={styles.balancesContainer}
          contentContainerStyle={styles.balancesContent}
          showsVerticalScrollIndicator={false}
          testID="balances-scroll"
        >
          <Text style={styles.sectionTitle}>Member Balances</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.memberBalancesScroll}
            testID="member-balances-scroll"
          >
            {(group?.members || []).map((memberId) => (
              <View key={memberId}>
                {renderMemberBalance({ item: memberId })}
              </View>
            ))}
          </ScrollView>

          {debts.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Suggested Settlements</Text>
              <FlatList
                data={debts}
                renderItem={renderDebtItem}
                keyExtractor={(item, index) => `${item?.from}-${item?.to}-${index}`}
                scrollEnabled={false}
                testID="debt-list"
              />
            </>
          )}

          {debts.length === 0 && renderEmptyBalances()}
        </ScrollView>
      )}

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleAddExpense}
          testID="add-expense-button"
          accessibilityLabel="Add expense"
        >
          <LinearGradient
            colors={[group?.color || '#2D3748', '#1A202C']}
            style={styles.actionButtonGradient}
          >
            <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Add Expense</Text>
          </LinearGradient>
        </TouchableOpacity>

        {debts.length > 0 && (
          <TouchableOpacity
            style={styles.settleButton}
            onPress={handleSettleUp}
            testID="settle-up-button"
            accessibilityLabel="Settle up"
          >
            <Ionicons name="checkmark-circle-outline" size={24} color="#2D3748" />
            <Text style={styles.settleButtonText}>Settle Up</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 16,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  tabActive: {
    borderBottomColor: '#2D3748',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A0AEC0',
  },
  tabTextActive: {
    color: '#2D3748',
  },
  expenseList: {
    padding: 16,
    paddingBottom: 100,
  },
  expenseCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  expenseIconContainer: {
    marginRight: 12,
  },
  expenseIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseContent: {
    flex: 1,
    justifyContent: 'center',
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  expenseMeta: {
    fontSize: 13,
    color: '#718096',
  },
  expenseDot: {
    fontSize: 13,
    color: '#CBD5E0',
    marginHorizontal: 6,
  },
  expenseDate: {
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 2,
  },
  expenseAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
  },
  balancesContainer: {
    flex: 1,
  },
  balancesContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    marginTop: 8,
  },
  memberBalancesScroll: {
    paddingBottom: 16,
    gap: 12,
  },
  memberBalanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: width * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberBalanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  memberAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatar: {
    fontSize: 24,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  memberBalanceBody: {
    gap: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#718096',
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  balanceDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  balanceNetLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  balanceNetValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  balancePositive: {
    color: '#48BB78',
  },
  balanceNegative: {
    color: '#F56565',
  },
  balanceNeutral: {
    color: '#A0AEC0',
  },
  debtCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  debtFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debtMemberContainer: {
    alignItems: 'center',
    flex: 1,
  },
  debtAvatar: {
    fontSize: 32,
    marginBottom: 8,
  },
  debtMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  debtArrowContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  debtAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  settleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
  },
});
