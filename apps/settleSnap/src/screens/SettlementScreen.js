import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { format, formatDistanceToNow } from 'date-fns';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

export default function SettlementScreen({ route, navigation }) {
  const { groupId, fromId, toId, suggestedAmount } = route?.params || {};

  const {
    groups,
    members,
    expenses,
    settlements,
    addSettlement,
    optimizedSettlements,
  } = useSettleSnap();

  const [selectedPayer, setSelectedPayer] = useState(fromId || null);
  const [selectedRecipient, setSelectedRecipient] = useState(toId || null);
  const [amount, setAmount] = useState(suggestedAmount ? suggestedAmount.toFixed(2) : '');
  const [notes, setNotes] = useState('');
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const currentGroup = useMemo(() => {
    return (groups || []).find(g => g?.id === groupId);
  }, [groups, groupId]);

  const groupMembers = useMemo(() => {
    if (!currentGroup?.members) return [];
    return (currentGroup.members || [])
      .map(memberId => {
        const member = (members || []).find(m => m?.id === memberId);
        return member;
      })
      .filter(Boolean);
  }, [currentGroup, members]);

  const calculateBalances = () => {
    const balances = {};
    const memberIds = currentGroup?.members || [];

    memberIds.forEach(memberId => {
      balances[memberId] = { paid: 0, owed: 0, net: 0 };
    });

    (expenses || [])
      .filter(exp => exp?.groupId === groupId)
      .forEach(expense => {
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

  const balances = useMemo(() => calculateBalances(), [expenses, groupId, currentGroup]);

  const suggestedSettlements = useMemo(() => {
    const suggestions = [];
    const memberIds = Object.keys(balances);

    const debtors = [];
    const creditors = [];

    memberIds.forEach(memberId => {
      const net = balances[memberId]?.net || 0;
      if (net < -0.01) {
        debtors.push({ id: memberId, amount: Math.abs(net) });
      } else if (net > 0.01) {
        creditors.push({ id: memberId, amount: net });
      }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const settleAmount = Math.min(debtor.amount, creditor.amount);

      if (settleAmount > 0.01) {
        suggestions.push({
          from: debtor.id,
          to: creditor.id,
          amount: settleAmount,
        });
      }

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return suggestions;
  }, [balances]);

  const settlementHistory = useMemo(() => {
    return (settlements || [])
      .filter(s => s?.groupId === groupId)
      .sort((a, b) => (b?.settledAt || 0) - (a?.settledAt || 0));
  }, [settlements, groupId]);

  const selectedPayerMember = useMemo(() => {
    return (members || []).find(m => m?.id === selectedPayer);
  }, [members, selectedPayer]);

  const selectedRecipientMember = useMemo(() => {
    return (members || []).find(m => m?.id === selectedRecipient);
  }, [members, selectedRecipient]);

  const handlePayerSelect = (memberId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPayer(memberId);
    setShowPayerModal(false);

    const suggestion = suggestedSettlements.find(
      s => s.from === memberId && s.to === selectedRecipient
    );
    if (suggestion) {
      setAmount(suggestion.amount.toFixed(2));
    }
  };

  const handleRecipientSelect = (memberId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecipient(memberId);
    setShowRecipientModal(false);

    const suggestion = suggestedSettlements.find(
      s => s.from === selectedPayer && s.to === memberId
    );
    if (suggestion) {
      setAmount(suggestion.amount.toFixed(2));
    }
  };

  const handleSuggestionPress = (suggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPayer(suggestion.from);
    setSelectedRecipient(suggestion.to);
    setAmount(suggestion.amount.toFixed(2));
  };

  const handleConfirmSettlement = async () => {
    if (!selectedPayer) {
      Alert.alert("Error", "Please select who is paying");
      return;
    }

    if (!selectedRecipient) {
      Alert.alert("Error", "Please select who is receiving payment");
      return;
    }

    if (selectedPayer === selectedRecipient) {
      Alert.alert("Error", "Payer and recipient cannot be the same person");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    setConfirming(true);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newSettlement = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      groupId: groupId,
      from: selectedPayer,
      to: selectedRecipient,
      amount: parsedAmount,
      settledAt: Date.now(),
      status: 'completed',
      notes: notes.trim() || undefined,
    };

    addSettlement(newSettlement);

    Animated.spring(successAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      setConfirming(false);
      successAnim.setValue(0);
      
      Alert.alert(
        "Settlement Recorded",
        `${selectedPayerMember?.name || 'Member'} paid ${selectedRecipientMember?.name || 'Member'} $${parsedAmount.toFixed(2)}`,
        [
          {
            text: "Record Another",
            onPress: () => {
              setSelectedPayer(null);
              setSelectedRecipient(null);
              setAmount('');
              setNotes('');
            },
          },
          {
            text: "Done",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }, 1500);
  };

  const renderMemberModal = (visible, onClose, onSelect, title, excludeId) => {
    const availableMembers = groupMembers.filter(m => m?.id !== excludeId);

    return (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              testID="close-modal-button"
              accessibilityLabel="Close modal"
            >
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {availableMembers.map(member => (
              <TouchableOpacity
                key={member?.id}
                style={styles.memberOption}
                onPress={() => onSelect(member?.id)}
                testID={`member-option-${member?.id}`}
                accessibilityLabel={`Select ${member?.name || 'member'}`}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member?.avatar || member?.name?.charAt(0) || '?'}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member?.name || 'Unknown'}</Text>
                  <Text style={styles.memberEmail}>{member?.email || ''}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#A0AEC0" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSettlementHistory = () => {
    if (settlementHistory.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color="#CBD5E0" />
          <Text style={styles.emptyStateText}>No settlement history yet</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={settlementHistory}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        renderItem={({ item }) => {
          const fromMember = (members || []).find(m => m?.id === item?.from);
          const toMember = (members || []).find(m => m?.id === item?.to);
          const settledDate = item?.settledAt ? new Date(item.settledAt) : new Date();
          const safeDate = isNaN(settledDate.getTime()) ? new Date() : settledDate;

          return (
            <View style={styles.historyItem} testID={`history-item-${item?.id}`}>
              <View style={styles.historyIconContainer}>
                <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
              </View>
              <View style={styles.historyContent}>
                <Text style={styles.historyTitle}>
                  {fromMember?.name || 'Member'} paid {toMember?.name || 'Member'}
                </Text>
                <Text style={styles.historyDate}>
                  {formatDistanceToNow(safeDate, { addSuffix: true })}
                </Text>
                {item?.notes && (
                  <Text style={styles.historyNotes}>{item.notes}</Text>
                )}
              </View>
              <Text style={styles.historyAmount}>${(item?.amount || 0).toFixed(2)}</Text>
            </View>
          );
        }}
        contentContainerStyle={styles.historyList}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settle Up</Text>
          <Text style={styles.headerSubtitle}>{currentGroup?.name || 'Group'}</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="swap-horizontal" size={18} color="#2D3748" /> Payment Details
          </Text>

          <TouchableOpacity
            style={styles.selector}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPayerModal(true);
            }}
            testID="select-payer-button"
            accessibilityLabel="Select who is paying"
          >
            <View style={styles.selectorContent}>
              <Ionicons name="person-outline" size={20} color="#4A5568" />
              <View style={styles.selectorText}>
                <Text style={styles.selectorLabel}>Who is paying?</Text>
                <Text style={styles.selectorValue}>
                  {selectedPayerMember?.name || 'Select member'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#A0AEC0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.selector}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowRecipientModal(true);
            }}
            testID="select-recipient-button"
            accessibilityLabel="Select who is receiving payment"
          >
            <View style={styles.selectorContent}>
              <Ionicons name="person-outline" size={20} color="#4A5568" />
              <View style={styles.selectorText}>
                <Text style={styles.selectorLabel}>Who is receiving?</Text>
                <Text style={styles.selectorValue}>
                  {selectedRecipientMember?.name || 'Select member'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#A0AEC0" />
          </TouchableOpacity>

          <View style={styles.amountContainer}>
            <Text style={styles.inputLabel}>
              <Ionicons name="cash-outline" size={18} color="#2D3748" /> Amount
            </Text>
            <View style={styles.amountInputWrapper}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#A0AEC0"
                keyboardType="decimal-pad"
                testID="amount-input"
                accessibilityLabel="Settlement amount"
              />
            </View>
          </View>

          <View style={styles.notesContainer}>
            <Text style={styles.inputLabel}>
              <Ionicons name="document-text-outline" size={18} color="#2D3748" /> Notes (optional)
            </Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note about this payment..."
              placeholderTextColor="#A0AEC0"
              multiline
              numberOfLines={3}
              testID="notes-input"
              accessibilityLabel="Settlement notes"
            />
          </View>
        </View>

        {suggestedSettlements.length > 0 && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="bulb-outline" size={18} color="#2D3748" /> Suggested Settlements
            </Text>
            <Text style={styles.suggestionsSubtitle}>
              Tap a suggestion to auto-fill the form
            </Text>
            {suggestedSettlements.map((suggestion, index) => {
              const fromMember = (members || []).find(m => m?.id === suggestion.from);
              const toMember = (members || []).find(m => m?.id === suggestion.to);

              return (
                <TouchableOpacity
                  key={`${suggestion.from}-${suggestion.to}-${index}`}
                  style={styles.suggestionCard}
                  onPress={() => handleSuggestionPress(suggestion)}
                  testID={`suggestion-${index}`}
                  accessibilityLabel={`Suggestion: ${fromMember?.name || 'Member'} pays ${toMember?.name || 'Member'} $${suggestion.amount.toFixed(2)}`}
                >
                  <View style={styles.suggestionContent}>
                    <View style={styles.suggestionMembers}>
                      <Text style={styles.suggestionMemberName}>
                        {fromMember?.name || 'Member'}
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="#4A5568" style={styles.suggestionArrow} />
                      <Text style={styles.suggestionMemberName}>
                        {toMember?.name || 'Member'}
                      </Text>
                    </View>
                    <Text style={styles.suggestionAmount}>
                      ${suggestion.amount.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.historySection}>
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowHistory(!showHistory);
            }}
            testID="toggle-history-button"
            accessibilityLabel={showHistory ? "Hide settlement history" : "Show settlement history"}
          >
            <Text style={styles.sectionTitle}>
              <Ionicons name="time-outline" size={18} color="#2D3748" /> Settlement History
            </Text>
            <Ionicons
              name={showHistory ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#4A5568"
            />
          </TouchableOpacity>
          {showHistory && renderSettlementHistory()}
        </View>
      </ScrollView>

      <Animated.View style={[styles.confirmButtonContainer, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmSettlement}
          disabled={confirming}
          testID="confirm-settlement-button"
          accessibilityLabel="Confirm settlement"
        >
          <LinearGradient
            colors={['#2D3748', '#1A202C']}
            style={styles.confirmGradient}
          >
            {confirming ? (
              <Animated.View style={{ opacity: successAnim }}>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              </Animated.View>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Record Settlement</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {showPayerModal && renderMemberModal(
        showPayerModal,
        () => setShowPayerModal(false),
        handlePayerSelect,
        "Who is paying?",
        selectedRecipient
      )}

      {showRecipientModal && renderMemberModal(
        showRecipientModal,
        () => setShowRecipientModal(false),
        handleRecipientSelect,
        "Who is receiving?",
        selectedPayer
      )}
    </KeyboardAvoidingView>
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
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#4A5568',
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 16,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    marginLeft: 12,
    flex: 1,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 2,
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  amountContainer: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3748',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingVertical: 16,
  },
  notesContainer: {
    marginTop: 16,
  },
  notesInput: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  suggestionsSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  suggestionsSubtitle: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 12,
  },
  suggestionCard: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  suggestionMemberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3748',
  },
  suggestionArrow: {
    marginHorizontal: 8,
  },
  suggestionAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
  },
  historySection: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyList: {
    marginTop: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  historyIconContainer: {
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 13,
    color: '#718096',
  },
  historyNotes: {
    fontSize: 13,
    color: '#4A5568',
    marginTop: 4,
    fontStyle: 'italic',
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#A0AEC0',
    marginTop: 12,
  },
  confirmButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
  },
  confirmButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalList: {
    padding: 16,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2D3748',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 20,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 13,
    color: '#718096',
  },
});
