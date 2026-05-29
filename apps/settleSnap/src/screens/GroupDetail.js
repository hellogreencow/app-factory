import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, format } from 'date-fns';
import { LongPressGestureHandler, State } from 'react-native-gesture-handler';
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

export default function GroupDetail({ route, navigation }) {
  const groupId = route?.params?.groupId;
  
  const {
    groups,
    members,
    expenses,
    updateGroup,
    deleteGroup,
    addExpense,
    deleteExpense,
  } = useSettleSnap();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#2E7D32');
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);

  const PRESET_COLORS = [
    '#FF6B6B',
    '#4ECDC4',
    '#95E1D3',
    '#F38181',
    '#AA96DA',
    '#FCBAD3',
    '#A8E6CF',
    '#FFD3B6',
    '#FFAAA5',
    '#FF8B94',
  ];

  const group = useMemo(() => {
    return (groups || []).find(g => g.id === groupId);
  }, [groups, groupId]);

  const groupExpenses = useMemo(() => {
    return (expenses || []).filter(e => e.groupId === groupId);
  }, [expenses, groupId]);

  const memberBalances = useMemo(() => {
    if (!group?.members) return [];

    const balances = {};
    
    (group.members || []).forEach(memberId => {
      balances[memberId] = 0;
    });

    (groupExpenses || []).forEach(expense => {
      const paidBy = expense.paidBy;
      const splitWith = expense.splitWith || [];
      const amount = expense.amount || 0;
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

    return Object.entries(balances).map(([memberId, balance]) => ({
      memberId,
      balance,
    }));
  }, [group, groupExpenses]);

  const availableMembers = useMemo(() => {
    const currentMemberIds = (group?.members || []).map(m => typeof m === 'string' ? m : m.id);
    return (members || []).filter(m => !currentMemberIds.includes(m.id));
  }, [members, group]);

  React.useEffect(() => {
    if (group) {
      navigation.setOptions({
        title: group.name || 'Group Details',
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              setGroupName(group.name || '');
              setSelectedColor(group.color || '#2E7D32');
              setEditModalVisible(true);
            }}
            style={styles.headerButton}
            testID="group-settings-button"
            accessibilityLabel="Open group settings"
          >
            <Ionicons name="settings-outline" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        ),
      });
    }
  }, [group, navigation]);

  if (!group) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={80} color="#757575" />
        <Text style={styles.emptyText}>Group not found</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          testID="back-button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getMemberInfo = (memberId) => {
    const id = typeof memberId === 'string' ? memberId : memberId?.id;
    return (members || []).find(m => m.id === id);
  };

  const handleUpdateGroup = () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    updateGroup(groupId, {
      name: groupName.trim(),
      color: selectedColor,
    });

    setEditModalVisible(false);
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? All expenses will also be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            deleteGroup(groupId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleAddMember = () => {
    if (!selectedMemberId) {
      Alert.alert('Error', 'Please select a member');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const currentMembers = (group.members || []).map(m => typeof m === 'string' ? m : m.id);
    updateGroup(groupId, {
      members: [...currentMembers, selectedMemberId],
    });

    setAddMemberModalVisible(false);
    setSelectedMemberId(null);
  };

  const handleMemberLongPress = (event, memberId) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setMemberToDelete(memberId);
      setDeleteConfirmVisible(true);
    }
  };

  const handleRemoveMember = () => {
    if (!memberToDelete) return;

    const hasExpenses = (groupExpenses || []).some(
      e => e.paidBy === memberToDelete || (e.splitWith || []).includes(memberToDelete)
    );

    if (hasExpenses) {
      Alert.alert(
        'Cannot Remove Member',
        'This member has expenses in the group. Please delete their expenses first.'
      );
      setDeleteConfirmVisible(false);
      setMemberToDelete(null);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const currentMembers = (group.members || []).map(m => typeof m === 'string' ? m : m.id);
    updateGroup(groupId, {
      members: currentMembers.filter(id => id !== memberToDelete),
    });

    setDeleteConfirmVisible(false);
    setMemberToDelete(null);
  };

  const handleAddExpense = () => {
    navigation.navigate('AddExpense', { groupId });
  };

  const handleExpensePress = (expense) => {
    navigation.navigate('ExpenseDetail', { expenseId: expense.id });
  };

  const renderMemberCard = (memberId, balance) => {
    const member = getMemberInfo(memberId);
    if (!member) return null;

    const isPositive = balance > 0;
    const isZero = Math.abs(balance) < 0.01;

    return (
      <LongPressGestureHandler
        key={member.id}
        onHandlerStateChange={(event) => handleMemberLongPress(event, member.id)}
        minDurationMs={500}
      >
        <View style={styles.memberCard}>
          <LinearGradient
            colors={isZero ? ['#F5F5F5', '#EEEEEE'] : isPositive ? ['#E8F5E9', '#C8E6C9'] : ['#FFEBEE', '#FFCDD2']}
            style={styles.memberCardGradient}
          >
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{member.avatar || '👤'}</Text>
            </View>
            <Text style={styles.memberName} numberOfLines={1}>
              {member.name || 'Unknown'}
            </Text>
            <View style={styles.balanceContainer}>
              <Text style={[
                styles.balanceAmount,
                isPositive && styles.positiveBalance,
                !isPositive && !isZero && styles.negativeBalance,
              ]}>
                {isPositive ? '+' : ''}{balance.toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>
                {isZero ? 'settled' : isPositive ? 'gets back' : 'owes'}
              </Text>
            </View>
          </LinearGradient>
        </View>
      </LongPressGestureHandler>
    );
  };

  const renderExpenseItem = (expense) => {
    const payer = getMemberInfo(expense.paidBy);
    const splitCount = (expense.splitWith || []).length;
    const categoryIcon = CATEGORY_ICONS[expense.category] || 'ellipsis-horizontal-outline';
    
    const expenseDate = new Date(expense.createdAt);
    const safeDate = isNaN(expenseDate.getTime()) ? new Date() : expenseDate;

    return (
      <TouchableOpacity
        key={expense.id}
        style={styles.expenseCard}
        onPress={() => handleExpensePress(expense)}
        testID={`expense-item-${expense.id}`}
        accessibilityLabel={`Expense: ${expense.description}`}
      >
        <View style={styles.expenseIconContainer}>
          <Ionicons name={categoryIcon} size={24} color={group.color || '#2E7D32'} />
        </View>
        <View style={styles.expenseContent}>
          <Text style={styles.expenseDescription} numberOfLines={1}>
            {expense.description || 'Untitled Expense'}
          </Text>
          <View style={styles.expenseMetaRow}>
            <Text style={styles.expensePayer}>
              {payer?.name || 'Unknown'} paid
            </Text>
            <Text style={styles.expenseDot}>•</Text>
            <Text style={styles.expenseSplit}>
              Split {splitCount} {splitCount === 1 ? 'way' : 'ways'}
            </Text>
            <Text style={styles.expenseDot}>•</Text>
            <Text style={styles.expenseDate}>
              {formatDistanceToNow(safeDate, { addSuffix: true })}
            </Text>
          </View>
        </View>
        <View style={styles.expenseAmountContainer}>
          <Text style={styles.expenseAmount}>
            ${(expense.amount || 0).toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[group.color || '#2E7D32', '#FAFAFA']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.groupTitle}>{group.name || 'Untitled Group'}</Text>
          <Text style={styles.groupSubtitle}>
            {(group.members || []).length} {(group.members || []).length === 1 ? 'member' : 'members'} • {groupExpenses.length} {groupExpenses.length === 1 ? 'expense' : 'expenses'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Member Balances</Text>
            <TouchableOpacity
              onPress={() => setAddMemberModalVisible(true)}
              style={styles.addButton}
              testID="add-member-button"
              accessibilityLabel="Add member to group"
            >
              <Ionicons name="person-add-outline" size={20} color="#2E7D32" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.memberScrollContent}
            testID="member-balance-scroll"
          >
            {(memberBalances || []).map(({ memberId, balance }) =>
              renderMemberCard(memberId, balance)
            )}
            {memberBalances.length === 0 && (
              <View style={styles.emptyMembersContainer}>
                <Ionicons name="people-outline" size={48} color="#BDBDBD" />
                <Text style={styles.emptyMembersText}>No members yet</Text>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Group Expenses</Text>
            <Text style={styles.expenseCount}>
              {groupExpenses.length} total
            </Text>
          </View>

          {(groupExpenses || []).length > 0 ? (
            <View style={styles.expenseList}>
              {groupExpenses
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                .map(renderExpenseItem)}
            </View>
          ) : (
            <View style={styles.emptyExpensesContainer}>
              <Ionicons name="receipt-outline" size={64} color="#BDBDBD" />
              <Text style={styles.emptyExpensesText}>No expenses yet</Text>
              <Text style={styles.emptyExpensesSubtext}>
                Tap the + button to add your first expense
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddExpense}
        testID="add-expense-fab"
        accessibilityLabel="Add new expense"
      >
        <LinearGradient
          colors={['#2E7D32', '#1B5E20']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Group Settings</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                testID="close-settings-modal"
                accessibilityLabel="Close settings"
              >
                <Ionicons name="close" size={28} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Group Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Enter group name"
                  placeholderTextColor="#9E9E9E"
                  testID="group-name-input"
                  accessibilityLabel="Group name input"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Group Color</Text>
                <View style={styles.colorGrid}>
                  {PRESET_COLORS.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedColor === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedColor(color);
                      }}
                      testID={`color-option-${color}`}
                      accessibilityLabel={`Select color ${color}`}
                    >
                      {selectedColor === color && (
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleUpdateGroup}
                testID="save-group-button"
                accessibilityLabel="Save group changes"
              >
                <LinearGradient
                  colors={['#2E7D32', '#1B5E20']}
                  style={styles.gradientButton}
                >
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteGroup}
                testID="delete-group-button"
                accessibilityLabel="Delete group"
              >
                <Ionicons name="trash-outline" size={20} color="#D32F2F" />
                <Text style={styles.deleteButtonText}>Delete Group</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={addMemberModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Member</Text>
              <TouchableOpacity
                onPress={() => {
                  setAddMemberModalVisible(false);
                  setSelectedMemberId(null);
                }}
                testID="close-add-member-modal"
                accessibilityLabel="Close add member"
              >
                <Ionicons name="close" size={28} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {(availableMembers || []).length > 0 ? (
                (availableMembers || []).map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.memberOption,
                      selectedMemberId === member.id && styles.memberOptionSelected,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedMemberId(member.id);
                    }}
                    testID={`member-option-${member.id}`}
                    accessibilityLabel={`Select ${member.name}`}
                  >
                    <Text style={styles.memberOptionAvatar}>{member.avatar || '👤'}</Text>
                    <View style={styles.memberOptionInfo}>
                      <Text style={styles.memberOptionName}>{member.name || 'Unknown'}</Text>
                      <Text style={styles.memberOptionEmail}>{member.email || ''}</Text>
                    </View>
                    {selectedMemberId === member.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyAvailableMembers}>
                  <Ionicons name="people-outline" size={64} color="#BDBDBD" />
                  <Text style={styles.emptyAvailableMembersText}>
                    All members have been added
                  </Text>
                </View>
              )}

              {availableMembers.length > 0 && (
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleAddMember}
                  testID="confirm-add-member-button"
                  accessibilityLabel="Confirm add member"
                >
                  <LinearGradient
                    colors={['#2E7D32', '#1B5E20']}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.saveButtonText}>Add Member</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteConfirmVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Ionicons name="warning-outline" size={48} color="#D32F2F" />
            <Text style={styles.confirmTitle}>Remove Member?</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to remove this member from the group?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmButtonCancel}
                onPress={() => {
                  setDeleteConfirmVisible(false);
                  setMemberToDelete