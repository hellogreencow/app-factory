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
import * as Sharing from 'expo-sharing';
import { formatDistanceToNow, format } from 'date-fns';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

const FILTER_TABS = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'owed', label: 'You Are Owed', icon: 'arrow-down-circle-outline' },
  { id: 'owing', label: 'You Owe', icon: 'arrow-up-circle-outline' },
];

export default function Balances({ navigation }) {
  const {
    groups,
    members,
    expenses,
    settlements,
    currentUser,
    addSettlement,
  } = useSettleSnap();

  const [selectedFilter, setSelectedFilter] = useState('all');

  const calculateBalances = () => {
    const balances = {};
    const currentUserId = currentUser?.id || 'current-user';

    (members || []).forEach(member => {
      if (member?.id) {
        balances[member.id] = { paid: 0, owed: 0, net: 0 };
      }
    });

    (expenses || []).forEach(expense => {
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
  };

  const balances = useMemo(() => calculateBalances(), [expenses, members, currentUser]);

  const currentUserId = currentUser?.id || 'current-user';

  const debts = useMemo(() => {
    const debtList = [];
    const memberIds = Object.keys(balances);

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const member1 = memberIds[i];
        const member2 = memberIds[j];
        const balance1 = balances[member1]?.net || 0;
        const balance2 = balances[member2]?.net || 0;

        if (balance1 < 0 && balance2 > 0) {
          const amount = Math.min(Math.abs(balance1), balance2);
          if (amount > 0.01) {
            debtList.push({
              id: `${member1}-${member2}`,
              from: member1,
              to: member2,
              amount: amount,
            });
          }
        } else if (balance2 < 0 && balance1 > 0) {
          const amount = Math.min(Math.abs(balance2), balance1);
          if (amount > 0.01) {
            debtList.push({
              id: `${member2}-${member1}`,
              from: member2,
              to: member1,
              amount: amount,
            });
          }
        }
      }
    }

    return debtList.filter(debt => debt.from === currentUserId || debt.to === currentUserId);
  }, [balances, currentUserId]);

  const filteredDebts = useMemo(() => {
    if (selectedFilter === 'all') {
      return debts;
    } else if (selectedFilter === 'owed') {
      return debts.filter(debt => debt.to === currentUserId);
    } else if (selectedFilter === 'owing') {
      return debts.filter(debt => debt.from === currentUserId);
    }
    return debts;
  }, [debts, selectedFilter, currentUserId]);

  const totalOwed = useMemo(() => {
    return debts
      .filter(debt => debt.to === currentUserId)
      .reduce((sum, debt) => sum + debt.amount, 0);
  }, [debts, currentUserId]);

  const totalOwing = useMemo(() => {
    return debts
      .filter(debt => debt.from === currentUserId)
      .reduce((sum, debt) => sum + debt.amount, 0);
  }, [debts, currentUserId]);

  const handleFilterChange = (filterId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(filterId);
  };

  const handleSettle = (debt) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const fromMember = (members || []).find(m => m?.id === debt.from);
    const toMember = (members || []).find(m => m?.id === debt.to);

    Alert.alert(
      'Settle Payment',
      `Mark payment of $${debt.amount.toFixed(2)} from ${fromMember?.name || 'Unknown'} to ${toMember?.name || 'Unknown'} as settled?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Settle',
          onPress: () => {
            const settlement = {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2),
              groupId: null,
              fromId: debt.from,
              toId: debt.to,
              amount: debt.amount,
              settledAt: Date.now(),
              status: 'completed',
            };

            addSettlement(settlement);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Payment marked as settled!');
          },
        },
      ]
    );
  };

  const handleReminder = async (debt) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const fromMember = (members || []).find(m => m?.id === debt.from);
    const toMember = (members || []).find(m => m?.id === debt.to);

    const message = `Reminder: ${fromMember?.name || 'Someone'} owes ${toMember?.name || 'you'} $${debt.amount.toFixed(2)} on SettleSnap`;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync('data:text/plain;base64,' + btoa(message), {
          mimeType: 'text/plain',
          dialogTitle: 'Send Payment Reminder',
          UTI: 'public.plain-text',
        });
      } else {
        Alert.alert('Share', message);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not share reminder');
    }
  };

  const renderSummaryCard = () => (
    <View style={styles.summaryContainer}>
      <LinearGradient
        colors={['#0A3D28', '#1B5E20']}
        style={styles.summaryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconContainer}>
              <Ionicons name="arrow-down-circle-outline" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.summaryLabel}>You Are Owed</Text>
            <Text style={styles.summaryAmount}>${totalOwed.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconContainer}>
              <Ionicons name="arrow-up-circle-outline" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.summaryLabel}>You Owe</Text>
            <Text style={styles.summaryAmount}>${totalOwing.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.netBalanceContainer}>
          <Ionicons
            name={totalOwed - totalOwing >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.netBalanceLabel}>Net Balance:</Text>
          <Text style={styles.netBalanceAmount}>
            ${Math.abs(totalOwed - totalOwing).toFixed(2)} {totalOwed - totalOwing >= 0 ? 'in your favor' : 'owed'}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      {FILTER_TABS.map(tab => {
        const isSelected = selectedFilter === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.filterTab, isSelected && styles.filterTabActive]}
            onPress={() => handleFilterChange(tab.id)}
            testID={`filter-tab-${tab.id}`}
            accessibilityLabel={`Filter by ${tab.label}`}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={isSelected ? '#FFFFFF' : '#757575'}
            />
            <Text style={[styles.filterTabText, isSelected && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderDebtItem = ({ item }) => {
    const fromMember = (members || []).find(m => m?.id === item.from);
    const toMember = (members || []).find(m => m?.id === item.to);
    const isOwing = item.from === currentUserId;

    const groupsInvolved = (groups || []).filter(group => {
      const groupExpenses = (expenses || []).filter(exp => exp?.groupId === group?.id);
      return groupExpenses.some(exp => {
        const splitWith = exp?.splitWith || [];
        return (
          (exp?.paidBy === item.from || exp?.paidBy === item.to) &&
          (splitWith.includes(item.from) || splitWith.includes(item.to))
        );
      });
    });

    return (
      <View style={styles.debtCard}>
        <View style={styles.debtHeader}>
          <View style={styles.debtAvatarContainer}>
            <View style={[styles.debtAvatar, { backgroundColor: isOwing ? '#D32F2F' : '#2E7D32' }]}>
              <Text style={styles.debtAvatarText}>
                {isOwing ? (fromMember?.avatar || '👤') : (toMember?.avatar || '👤')}
              </Text>
            </View>
          </View>

          <View style={styles.debtInfo}>
            <Text style={styles.debtTitle}>
              {isOwing ? `You owe ${toMember?.name || 'Unknown'}` : `${fromMember?.name || 'Unknown'} owes you`}
            </Text>
            {groupsInvolved.length > 0 && (
              <View style={styles.debtGroupsContainer}>
                <Ionicons name="people-outline" size={14} color="#757575" />
                <Text style={styles.debtGroupsText}>
                  {groupsInvolved.map(g => g?.name).join(', ')}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.debtAmount, { color: isOwing ? '#D32F2F' : '#2E7D32' }]}>
            ${item.amount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.debtActions}>
          <TouchableOpacity
            style={styles.debtActionButton}
            onPress={() => handleSettle(item)}
            testID={`settle-button-${item.id}`}
            accessibilityLabel={`Settle payment of ${item.amount.toFixed(2)}`}
          >
            <LinearGradient
              colors={['#2E7D32', '#1B5E20']}
              style={styles.debtActionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.debtActionText}>Settle Up</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.debtReminderButton}
            onPress={() => handleReminder(item)}
            testID={`reminder-button-${item.id}`}
            accessibilityLabel="Send payment reminder"
          >
            <Ionicons name="notifications-outline" size={18} color="#2E7D32" />
            <Text style={styles.debtReminderText}>Remind</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="wallet-outline" size={80} color="#E0E0E0" />
      </View>
      <Text style={styles.emptyTitle}>All Settled Up!</Text>
      <Text style={styles.emptyText}>
        {selectedFilter === 'all'
          ? "The ledger is clean. Everyone is square."
          : selectedFilter === 'owed'
          ? "Nobody owes you money right now"
          : "You don't owe anyone money right now"}
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('Groups')}
        testID="empty-state-groups-button"
        accessibilityLabel="Go to groups"
      >
        <Ionicons name="people-outline" size={20} color="#2E7D32" />
        <Text style={styles.emptyButtonText}>View Groups</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderSummaryCard()}
        {renderFilterTabs()}

        <View style={styles.listContainer}>
          {filteredDebts.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={filteredDebts}
              renderItem={renderDebtItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 20,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIconContainer: {
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 16,
  },
  netBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  netBalanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
    marginRight: 4,
    fontWeight: '600',
  },
  netBalanceAmount: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  listContent: {
    gap: 12,
  },
  debtCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  debtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  debtAvatarContainer: {
    marginRight: 12,
  },
  debtAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtAvatarText: {
    fontSize: 24,
  },
  debtInfo: {
    flex: 1,
  },
  debtTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  debtGroupsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  debtGroupsText: {
    fontSize: 12,
    color: '#757575',
  },
  debtAmount: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
  debtActions: {
    flexDirection: 'row',
    gap: 8,
  },
  debtActionButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  debtActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  debtActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  debtReminderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  debtReminderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
});
