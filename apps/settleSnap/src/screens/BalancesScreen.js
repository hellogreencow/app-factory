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
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

export default function BalancesScreen({ navigation }) {
  const {
    groups,
    members,
    expenses,
    settlements,
    currentUser,
  } = useSettleSnap();

  const [selectedTab, setSelectedTab] = useState('debts');

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
              from: member1,
              to: member2,
              amount: amount,
            });
          }
        } else if (balance2 < 0 && balance1 > 0) {
          const amount = Math.min(Math.abs(balance2), balance1);
          if (amount > 0.01) {
            debtList.push({
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

  const myDebts = useMemo(() => {
    return debts.filter(debt => debt.from === currentUserId);
  }, [debts, currentUserId]);

  const myCredits = useMemo(() => {
    return debts.filter(debt => debt.to === currentUserId);
  }, [debts, currentUserId]);

  const totalOwed = useMemo(() => {
    return myDebts.reduce((sum, debt) => sum + debt.amount, 0);
  }, [myDebts]);

  const totalOwedToYou = useMemo(() => {
    return myCredits.reduce((sum, credit) => sum + credit.amount, 0);
  }, [myCredits]);

  const netBalance = totalOwedToYou - totalOwed;

  const handleSettle = (debt) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Settle Payment',
      `Mark payment of $${debt.amount.toFixed(2)} as settled?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          style: 'default',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Payment marked as settled!');
          },
        },
      ]
    );
  };

  const handleReminder = async (credit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const fromMember = (members || []).find(m => m?.id === credit.from);
    const toMember = (members || []).find(m => m?.id === credit.to);
    
    const message = `Hey ${fromMember?.name || 'there'}! Just a friendly reminder that you owe ${toMember?.name || 'me'} $${credit.amount.toFixed(2)}. Thanks! 😊`;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync('data:text/plain,' + encodeURIComponent(message), {
          dialogTitle: 'Send Payment Reminder',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Reminder', message);
      }
    } catch (error) {
      Alert.alert('Reminder', message);
    }
  };

  const getMemberName = (memberId) => {
    const member = (members || []).find(m => m?.id === memberId);
    return member?.name || 'Unknown';
  };

  const getMemberAvatar = (memberId) => {
    const member = (members || []).find(m => m?.id === memberId);
    return member?.avatar || '👤';
  };

  const renderDebtItem = ({ item }) => {
    const toMember = (members || []).find(m => m?.id === item.to);
    
    return (
      <View style={styles.debtCard} testID={`debt-item-${item.to}`}>
        <View style={styles.debtLeft}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{getMemberAvatar(item.to)}</Text>
          </View>
          <View style={styles.debtInfo}>
            <Text style={styles.debtName}>{getMemberName(item.to)}</Text>
            <Text style={styles.debtLabel}>You owe</Text>
          </View>
        </View>
        <View style={styles.debtRight}>
          <Text style={styles.debtAmount}>${item.amount.toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.settleButton}
            onPress={() => handleSettle(item)}
            testID={`settle-button-${item.to}`}
            accessibilityLabel={`Settle debt with ${getMemberName(item.to)}`}
          >
            <LinearGradient
              colors={['#2D3748', '#4A5568']}
              style={styles.settleGradient}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.settleText}>Settle</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCreditItem = ({ item }) => {
    const fromMember = (members || []).find(m => m?.id === item.from);
    
    return (
      <View style={styles.creditCard} testID={`credit-item-${item.from}`}>
        <View style={styles.debtLeft}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{getMemberAvatar(item.from)}</Text>
          </View>
          <View style={styles.debtInfo}>
            <Text style={styles.debtName}>{getMemberName(item.from)}</Text>
            <Text style={styles.creditLabel}>Owes you</Text>
          </View>
        </View>
        <View style={styles.debtRight}>
          <Text style={styles.creditAmount}>${item.amount.toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.reminderButton}
            onPress={() => handleReminder(item)}
            testID={`reminder-button-${item.from}`}
            accessibilityLabel={`Send reminder to ${getMemberName(item.from)}`}
          >
            <Ionicons name="notifications-outline" size={20} color="#2D3748" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyDebts = () => (
    <View style={styles.emptyState} testID="empty-debts">
      <Ionicons name="checkmark-circle-outline" size={80} color="#95E1D3" />
      <Text style={styles.emptyTitle}>All Clear!</Text>
      <Text style={styles.emptyText}>You don't owe anyone right now</Text>
    </View>
  );

  const renderEmptyCredits = () => (
    <View style={styles.emptyState} testID="empty-credits">
      <Ionicons name="wallet-outline" size={80} color="#CBD5E0" />
      <Text style={styles.emptyTitle}>No Credits</Text>
      <Text style={styles.emptyText}>Nobody owes you money at the moment</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={netBalance >= 0 ? ['#95E1D3', '#4ECDC4'] : ['#F38181', '#FF6B6B']}
          style={styles.summaryCard}
          testID="balance-summary-card"
        >
          <View style={styles.summaryHeader}>
            <Ionicons
              name={netBalance >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
              size={32}
              color="#FFFFFF"
            />
            <Text style={styles.summaryTitle}>Net Balance</Text>
          </View>
          <Text style={styles.summaryAmount} testID="net-balance-amount">
            {netBalance >= 0 ? '+' : ''}${Math.abs(netBalance).toFixed(2)}
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="arrow-up-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.summaryLabel}>You Owe</Text>
              <Text style={styles.summaryValue} testID="total-owed-amount">
                ${totalOwed.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="arrow-down-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.summaryLabel}>Owed to You</Text>
              <Text style={styles.summaryValue} testID="total-owed-to-you-amount">
                ${totalOwedToYou.toFixed(2)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              selectedTab === 'debts' && styles.segmentButtonActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTab('debts');
            }}
            testID="tab-debts"
            accessibilityLabel="View debts"
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={20}
              color={selectedTab === 'debts' ? '#FFFFFF' : '#2D3748'}
            />
            <Text
              style={[
                styles.segmentText,
                selectedTab === 'debts' && styles.segmentTextActive,
              ]}
            >
              You Owe ({myDebts.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              selectedTab === 'credits' && styles.segmentButtonActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTab('credits');
            }}
            testID="tab-credits"
            accessibilityLabel="View credits"
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={20}
              color={selectedTab === 'credits' ? '#FFFFFF' : '#2D3748'}
            />
            <Text
              style={[
                styles.segmentText,
                selectedTab === 'credits' && styles.segmentTextActive,
              ]}
            >
              Owed to You ({myCredits.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {selectedTab === 'debts' ? (
            myDebts.length > 0 ? (
              <FlatList
                data={myDebts}
                renderItem={renderDebtItem}
                keyExtractor={(item) => `${item.from}-${item.to}`}
                scrollEnabled={false}
                testID="debt-list"
              />
            ) : (
              renderEmptyDebts()
            )
          ) : (
            myCredits.length > 0 ? (
              <FlatList
                data={myCredits}
                renderItem={renderCreditItem}
                keyExtractor={(item) => `${item.from}-${item.to}`}
                scrollEnabled={false}
                testID="credit-list"
              />
            ) : (
              renderEmptyCredits()
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  summaryAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#2D3748',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginLeft: 8,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  debtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  creditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  debtLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatar: {
    fontSize: 24,
  },
  debtInfo: {
    flex: 1,
  },
  debtName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  debtLabel: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  creditLabel: {
    fontSize: 13,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  debtRight: {
    alignItems: 'flex-end',
  },
  debtAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B6B',
    marginBottom: 8,
  },
  creditAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4ECDC4',
    marginBottom: 8,
  },
  settleButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  settleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  settleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  reminderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },
});
