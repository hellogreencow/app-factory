import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

export default function GroupsList({ navigation }) {
  const {
    groups,
    members,
    expenses,
  } = useSettleSnap();

  const groupsWithBalances = useMemo(() => {
    return (groups || []).map(group => {
      const groupExpenses = (expenses || []).filter(exp => exp?.groupId === group?.id);
      
      const balances = {};
      (group?.members || []).forEach(memberId => {
        balances[memberId] = 0;
      });

      groupExpenses.forEach(expense => {
        const paidBy = expense?.paidBy;
        const splitWith = expense?.splitWith || [];
        const amount = expense?.amount || 0;
        const perPerson = splitWith.length > 0 ? amount / splitWith.length : 0;

        if (balances[paidBy] !== undefined) {
          balances[paidBy] += amount;
        }

        splitWith.forEach(memberId => {
          if (balances[memberId] !== undefined) {
            balances[memberId] -= perPerson;
          }
        });
      });

      const netBalance = Object.values(balances).reduce((sum, bal) => sum + bal, 0);
      const memberCount = (group?.members || []).length;

      return {
        ...group,
        netBalance,
        memberCount,
      };
    });
  }, [groups, expenses]);

  const totalStats = useMemo(() => {
    let totalOwed = 0;
    let totalOwe = 0;

    (expenses || []).forEach(expense => {
      const paidBy = expense?.paidBy;
      const splitWith = expense?.splitWith || [];
      const amount = expense?.amount || 0;
      const perPerson = splitWith.length > 0 ? amount / splitWith.length : 0;

      splitWith.forEach(memberId => {
        if (memberId !== paidBy) {
          totalOwe += perPerson;
        }
      });

      if (splitWith.includes(paidBy)) {
        totalOwed += amount - perPerson;
      } else {
        totalOwed += amount;
      }
    });

    return { totalOwed, totalOwe };
  }, [expenses]);

  const handleGroupPress = (groupId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('GroupDetail', { groupId });
  };

  const handleCreateGroup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Groups');
  };

  const renderGroupCard = (group) => {
    const isPositive = (group?.netBalance || 0) >= 0;
    const balanceColor = isPositive ? '#2E7D32' : '#D32F2F';

    return (
      <TouchableOpacity
        key={group?.id}
        style={styles.groupCard}
        onPress={() => handleGroupPress(group?.id)}
        testID={`group-card-${group?.id}`}
        accessibilityLabel={`Group ${group?.name}, ${group?.memberCount} members, balance ${Math.abs(group?.netBalance || 0).toFixed(2)}`}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#FFFFFF', '#F5F5F5']}
          style={styles.cardGradient}
        >
          <View style={styles.cardHeader}>
            <View style={styles.groupIconContainer}>
              <LinearGradient
                colors={[group?.color || '#2E7D32', group?.color || '#1B5E20']}
                style={styles.groupIcon}
              >
                <Ionicons name="people" size={24} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName} numberOfLines={1}>
                {group?.name || 'Unnamed Group'}
              </Text>
              <View style={styles.memberCountContainer}>
                <Ionicons name="person-outline" size={14} color="#757575" />
                <Text style={styles.memberCount}>
                  {group?.memberCount || 0} {(group?.memberCount || 0) === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.balanceContainer}>
            <View style={styles.balanceRow}>
              <Ionicons
                name={isPositive ? 'trending-up-outline' : 'trending-down-outline'}
                size={20}
                color={balanceColor}
              />
              <Text style={styles.balanceLabel}>Net Balance</Text>
            </View>
            <Text style={[styles.balanceAmount, { color: balanceColor }]}>
              {isPositive ? '+' : '-'}${Math.abs(group?.netBalance || 0).toFixed(2)}
            </Text>
          </View>

          <View style={styles.cardFooter}>
            <Ionicons name="chevron-forward" size={20} color="#757575" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2E7D32', '#1B5E20']}
        style={styles.header}
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="arrow-down-circle-outline" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>You Owe</Text>
              <Text style={styles.statAmount} testID="total-owe-amount">
                ${totalStats.totalOwe.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="arrow-up-circle-outline" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>Owed to You</Text>
              <Text style={styles.statAmount} testID="total-owed-amount">
                ${totalStats.totalOwed.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {(groupsWithBalances || []).length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={64} color="#757575" />
            </View>
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptyText}>
              Create your first group to start tracking shared expenses
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleCreateGroup}
              testID="empty-create-group-button"
              accessibilityLabel="Create your first group"
            >
              <LinearGradient
                colors={['#2E7D32', '#1B5E20']}
                style={styles.emptyButtonGradient}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Create Group</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          (groupsWithBalances || []).map(group => renderGroupCard(group))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateGroup}
        testID="create-group-fab"
        accessibilityLabel="Create new group"
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#2E7D32', '#1B5E20']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    opacity: 0.3,
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  groupCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardGradient: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupIconContainer: {
    marginRight: 12,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  memberCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 8,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardFooter: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 28,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
