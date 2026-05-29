import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { formatDistanceToNow, format } from 'date-fns';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

export default function Settlements({ navigation }) {
  const {
    groups,
    members,
    expenses,
    settlements,
    memberDebts,
    suggestedSettlements,
    settlePayment,
    currentUser,
  } = useSettleSnap();

  const [selectedGroupFilter, setSelectedGroupFilter] = useState(null);

  const calculateBalances = () => {
    const balances = {};
    const currentUserId = currentUser?.id || 'current-user';

    (expenses || []).forEach(expense => {
      if (selectedGroupFilter && expense.groupId !== selectedGroupFilter) return;

      const paidBy = expense.paidBy;
      const splitWith = expense.splitWith || [];
      const amount = expense.amount || 0;
      const perPerson = splitWith.length > 0 ? amount / splitWith.length : 0;

      splitWith.forEach(memberId => {
        if (memberId !== paidBy) {
          const key = memberId < paidBy ? `${memberId}-${paidBy}` : `${paidBy}-${memberId}`;
          if (!balances[key]) {
            balances[key] = { from: memberId, to: paidBy, amount: 0 };
          }
          if (memberId < paidBy) {
            balances[key].amount -= perPerson;
          } else {
            balances[key].amount += perPerson;
          }
        }
      });
    });

    const debts = [];
    Object.values(balances).forEach(balance => {
      if (Math.abs(balance.amount) > 0.01) {
        if (balance.amount > 0) {
          debts.push({ from: balance.from, to: balance.to, amount: balance.amount });
        } else {
          debts.push({ from: balance.to, to: balance.from, amount: Math.abs(balance.amount) });
        }
      }
    });

    return debts;
  };

  const balances = useMemo(() => calculateBalances(), [expenses, selectedGroupFilter]);

  const netBalance = useMemo(() => {
    const currentUserId = currentUser?.id || 'current-user';
    let youOwe = 0;
    let owedToYou = 0;

    balances.forEach(debt => {
      if (debt.from === currentUserId) {
        youOwe += debt.amount;
      } else if (debt.to === currentUserId) {
        owedToYou += debt.amount;
      }
    });

    return { youOwe, owedToYou, net: owedToYou - youOwe };
  }, [balances, currentUser]);

  const optimizedPayments = useMemo(() => {
    const payments = [...balances];
    return payments.sort((a, b) => b.amount - a.amount);
  }, [balances]);

  const settledHistory = useMemo(() => {
    return (settlements || [])
      .filter(s => s.settled)
      .sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0));
  }, [settlements]);

  const getMemberName = (memberId) => {
    const member = (members || []).find(m => m.id === memberId);
    return member?.name || 'Unknown';
  };

  const handleSettlePayment = async (payment) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const settlementId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    await settlePayment({
      id: settlementId,
      groupId: selectedGroupFilter || 'all',
      from: payment.from,
      to: payment.to,
      amount: payment.amount,
      settled: true,
      settledAt: Date.now(),
    });

    Alert.alert('Payment Settled', `${getMemberName(payment.from)} paid ${getMemberName(payment.to)} $${payment.amount.toFixed(2)}`);
  };

  const handleSendReminder = async (payment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const message = `Hi ${getMemberName(payment.from)},\n\nFriendly reminder: You owe ${getMemberName(payment.to)} $${payment.amount.toFixed(2)} in SettleSnap.\n\nThanks!`;

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync('data:text/plain;base64,' + btoa(message), {
          mimeType: 'text/plain',
          dialogTitle: 'Send Payment Reminder',
        });
      } else {
        Alert.alert('Reminder', message);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not send reminder');
    }
  };

  const renderRightActions = (progress, dragX, payment) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity
          style={styles.settleButton}
          onPress={() => handleSettlePayment(payment)}
          testID={`settle-payment-${payment.from}-${payment.to}`}
          accessibilityLabel={`Settle payment from ${getMemberName(payment.from)} to ${getMemberName(payment.to)}`}
        >
          <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>Settle</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderBalanceChart = () => {
    const chartSize = 180;
    const centerX = chartSize / 2;
    const centerY = chartSize / 2;
    const radius = 70;

    const total = Math.abs(netBalance.net);
    const isPositive = netBalance.net >= 0;

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartSize} height={chartSize}>
          <Circle
            cx={centerX}
            cy={centerY}
            r={radius}
            stroke="#E0E0E0"
            strokeWidth="12"
            fill="none"
          />
          <Circle
            cx={centerX}
            cy={centerY}
            r={radius}
            stroke={isPositive ? "#2E7D32" : "#D32F2F"}
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${2 * Math.PI * radius * 0.7} ${2 * Math.PI * radius}`}
            rotation="-90"
            origin={`${centerX}, ${centerY}`}
          />
          <SvgText
            x={centerX}
            y={centerY - 10}
            textAnchor="middle"
            fontSize="24"
            fontWeight="bold"
            fill={isPositive ? "#2E7D32" : "#D32F2F"}
          >
            {isPositive ? '+' : '-'}${Math.abs(netBalance.net).toFixed(0)}
          </SvgText>
          <SvgText
            x={centerX}
            y={centerY + 15}
            textAnchor="middle"
            fontSize="12"
            fill="#757575"
          >
            Net Balance
          </SvgText>
        </Svg>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2E7D32', '#1B5E20']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Settlements</Text>
        <Text style={styles.headerSubtitle}>Track and settle debts</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <LinearGradient
            colors={['#FFFFFF', '#F5F5F5']}
            style={styles.balanceCardGradient}
          >
            {renderBalanceChart()}
            
            <View style={styles.balanceDetails}>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Ionicons name="arrow-down-circle" size={24} color="#2E7D32" />
                  <Text style={styles.balanceLabel}>You're owed</Text>
                  <Text style={styles.balanceAmount}>${netBalance.owedToYou.toFixed(2)}</Text>
                </View>
                
                <View style={styles.balanceDivider} />
                
                <View style={styles.balanceItem}>
                  <Ionicons name="arrow-up-circle" size={24} color="#D32F2F" />
                  <Text style={styles.balanceLabel}>You owe</Text>
                  <Text style={styles.balanceAmount}>${netBalance.youOwe.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {(groups || []).length > 0 && (
          <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedGroupFilter && styles.filterChipActive]}
                onPress={() => setSelectedGroupFilter(null)}
                testID="filter-all-groups"
                accessibilityLabel="Show all groups"
              >
                <Text style={[styles.filterChipText, !selectedGroupFilter && styles.filterChipTextActive]}>
                  All Groups
                </Text>
              </TouchableOpacity>
              {(groups || []).map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.filterChip, selectedGroupFilter === group.id && styles.filterChipActive]}
                  onPress={() => setSelectedGroupFilter(group.id)}
                  testID={`filter-group-${group.id}`}
                  accessibilityLabel={`Filter by ${group.name}`}
                >
                  <View style={[styles.groupColorDot, { backgroundColor: group.color || '#2E7D32' }]} />
                  <Text style={[styles.filterChipText, selectedGroupFilter === group.id && styles.filterChipTextActive]}>
                    {group.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={24} color="#2E7D32" />
            <Text style={styles.sectionTitle}>Suggested Handshakes</Text>
          </View>
          
          {optimizedPayments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={64} color="#757575" />
              <Text style={styles.emptyStateTitle}>Quiet Ledger</Text>
              <Text style={styles.emptyStateText}>No outstanding payments</Text>
            </View>
          ) : (
            optimizedPayments.map((payment, index) => (
              <Swipeable
                key={`${payment.from}-${payment.to}-${index}`}
                renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, payment)}
                overshootRight={false}
                testID={`swipeable-payment-${index}`}
              >
                <View style={styles.paymentCard}>
                  <View style={styles.paymentLeft}>
                    <View style={styles.avatarContainer}>
                      <View style={[styles.avatar, { backgroundColor: '#2E7D32' }]}>
                        <Text style={styles.avatarText}>
                          {getMemberName(payment.from).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={20} color="#757575" style={styles.arrowIcon} />
                      <View style={[styles.avatar, { backgroundColor: '#1976D2' }]}>
                        <Text style={styles.avatarText}>
                          {getMemberName(payment.to).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentText}>
                        <Text style={styles.paymentName}>{getMemberName(payment.from)}</Text>
                        {' pays '}
                        <Text style={styles.paymentName}>{getMemberName(payment.to)}</Text>
                      </Text>
                      <Text style={styles.paymentHint}>Swipe left to settle</Text>
                    </View>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentAmount}>${payment.amount.toFixed(2)}</Text>
                    <TouchableOpacity
                      style={styles.reminderButton}
                      onPress={() => handleSendReminder(payment)}
                      testID={`send-reminder-${payment.from}-${payment.to}`}
                      accessibilityLabel="Send payment reminder"
                    >
                      <Ionicons name="notifications-outline" size={20} color="#2E7D32" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Swipeable>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={24} color="#2E7D32" />
            <Text style={styles.sectionTitle}>Settlement History</Text>
          </View>
          
          {settledHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color="#757575" />
              <Text style={styles.emptyStateTitle}>No History Yet</Text>
              <Text style={styles.emptyStateText}>Settled payments will appear here</Text>
            </View>
          ) : (
            settledHistory.map((settlement, index) => {
              const settledDate = new Date(settlement.settledAt || Date.now());
              const safeDate = isNaN(settledDate.getTime()) ? new Date() : settledDate;
              
              return (
                <View key={settlement.id || index} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <View style={styles.historyIconContainer}>
                      <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyText}>
                        <Text style={styles.historyName}>{getMemberName(settlement.from)}</Text>
                        {' paid '}
                        <Text style={styles.historyName}>{getMemberName(settlement.to)}</Text>
                      </Text>
                      <Text style={styles.historyDate}>
                        {formatDistanceToNow(safeDate, { addSuffix: true })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyAmount}>${settlement.amount.toFixed(2)}</Text>
                    <View style={styles.confirmedBadge}>
                      <Ionicons name="shield-checkmark" size={14} color="#2E7D32" />
                      <Text style={styles.confirmedText}>Confirmed</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E8F5E9',
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  balanceCardGradient: {
    padding: 24,
    alignItems: 'center',
  },
  chartContainer: {
    marginBottom: 24,
  },
  balanceDetails: {
    width: '100%',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#757575',
    marginTop: 8,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterChipText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  groupColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  paymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  paymentLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  arrowIcon: {
    marginHorizontal: 4,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  paymentName: {
    fontWeight: 'bold',
  },
  paymentHint: {
    fontSize: 12,
    color: '#757575',
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  reminderButton: {
    padding: 4,
  },
  swipeActions: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: 16,
    marginBottom: 12,
  },
  settleButton: {
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',