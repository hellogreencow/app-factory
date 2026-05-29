import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: 'cash-outline', color: '#2E7D32' },
  { id: 'venmo', label: 'Venmo', icon: 'logo-venmo', color: '#3D95CE' },
  { id: 'paypal', label: 'PayPal', icon: 'logo-paypal', color: '#003087' },
  { id: 'zelle', label: 'Zelle', icon: 'flash-outline', color: '#6D1ED4' },
  { id: 'bank', label: 'Bank Transfer', icon: 'business-outline', color: '#1976D2' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', color: '#757575' },
];

export default function SettlePayment({ route, navigation }) {
  const { debtId, fromId, toId, amount: totalAmount, groupId } = route?.params || {};
  
  const {
    members,
    groups,
    addSettlement,
  } = useSettleSnap();

  const [selectedMethod, setSelectedMethod] = useState('cash');
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [settlementId, setSettlementId] = useState(null);

  const fromMember = useMemo(() => {
    return (members || []).find(m => m?.id === fromId);
  }, [members, fromId]);

  const toMember = useMemo(() => {
    return (members || []).find(m => m?.id === toId);
  }, [members, toId]);

  const group = useMemo(() => {
    return (groups || []).find(g => g?.id === groupId);
  }, [groups, groupId]);

  const settlementAmount = useMemo(() => {
    if (isPartial && partialAmount) {
      const parsed = parseFloat(partialAmount);
      return isNaN(parsed) ? 0 : Math.min(parsed, totalAmount || 0);
    }
    return totalAmount || 0;
  }, [isPartial, partialAmount, totalAmount]);

  const handleMethodSelect = (methodId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMethod(methodId);
  };

  const handlePartialToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPartial(!isPartial);
    if (!isPartial) {
      setPartialAmount('');
    }
  };

  const handleConfirmSettlement = async () => {
    if (settlementAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid settlement amount');
      return;
    }

    if (isPartial && settlementAmount > (totalAmount || 0)) {
      Alert.alert('Invalid Amount', 'Partial payment cannot exceed total debt');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProcessing(true);

    try {
      const newSettlement = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        groupId: groupId || null,
        fromId: fromId,
        toId: toId,
        amount: settlementAmount,
        settledAt: Date.now(),
        status: 'completed',
        method: selectedMethod,
        notes: notes.trim(),
        isPartial: isPartial,
      };

      addSettlement(newSettlement);
      setSettlementId(newSettlement.id);
      setProcessing(false);
      setShowSuccessModal(true);
    } catch (error) {
      setProcessing(false);
      Alert.alert('Error', 'Failed to record settlement. Please try again.');
    }
  };

  const handleShareReceipt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const receiptText = `
SettleSnap Payment Receipt

From: ${fromMember?.name || 'Unknown'}
To: ${toMember?.name || 'Unknown'}
Amount: $${settlementAmount.toFixed(2)}
Method: ${PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label || 'Unknown'}
Date: ${format(new Date(), 'MMM dd, yyyy h:mm a')}
${notes ? `\nNotes: ${notes}` : ''}
${group ? `\nGroup: ${group.name}` : ''}

Thank you for using SettleSnap!
    `.trim();

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync('data:text/plain;base64,' + btoa(receiptText), {
          mimeType: 'text/plain',
          dialogTitle: 'Share Settlement Receipt',
          UTI: 'public.plain-text',
        });
      } else {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSuccessModal(false);
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Settlement Summary Card */}
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['#2E7D32', '#1B5E20']}
            style={styles.summaryGradient}
          >
            <View style={styles.summaryHeader}>
              <Ionicons name="swap-horizontal-outline" size={32} color="#FFFFFF" />
              <Text style={styles.summaryTitle}>Settlement Details</Text>
            </View>

            <View style={styles.memberFlow}>
              <View style={styles.memberInfo}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>{fromMember?.avatar || '👤'}</Text>
                </View>
                <Text style={styles.memberName}>{fromMember?.name || 'Unknown'}</Text>
                <Text style={styles.memberLabel}>Paying</Text>
              </View>

              <Ionicons name="arrow-forward" size={28} color="#FFFFFF" style={styles.arrowIcon} />

              <View style={styles.memberInfo}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>{toMember?.avatar || '👤'}</Text>
                </View>
                <Text style={styles.memberName}>{toMember?.name || 'Unknown'}</Text>
                <Text style={styles.memberLabel}>Receiving</Text>
              </View>
            </View>

            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Amount</Text>
              <Text style={styles.amountValue}>${settlementAmount.toFixed(2)}</Text>
              {isPartial && (
                <Text style={styles.partialLabel}>
                  Partial payment of ${(totalAmount || 0).toFixed(2)}
                </Text>
              )}
            </View>

            {group && (
              <View style={styles.groupBadge}>
                <Ionicons name="people-outline" size={14} color="#FFFFFF" />
                <Text style={styles.groupBadgeText}>{group.name}</Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Partial Payment Toggle */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.partialToggle}
            onPress={handlePartialToggle}
            testID="partial-payment-toggle"
            accessibilityLabel="Toggle partial payment"
          >
            <View style={styles.partialToggleLeft}>
              <Ionicons
                name={isPartial ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={isPartial ? '#2E7D32' : '#757575'}
              />
              <Text style={styles.partialToggleText}>Partial Payment</Text>
            </View>
            <Ionicons name="calculator-outline" size={20} color="#757575" />
          </TouchableOpacity>

          {isPartial && (
            <View style={styles.partialInputContainer}>
              <Text style={styles.partialInputLabel}>Enter partial amount</Text>
              <View style={styles.partialInputWrapper}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.partialInput}
                  value={partialAmount}
                  onChangeText={setPartialAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#BDBDBD"
                  testID="partial-amount-input"
                  accessibilityLabel="Partial amount input"
                />
              </View>
              <Text style={styles.partialHint}>
                Maximum: ${(totalAmount || 0).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Payment Method Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.methodGrid}>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodCard,
                  selectedMethod === method.id && styles.methodCardSelected,
                ]}
                onPress={() => handleMethodSelect(method.id)}
                testID={`payment-method-${method.id}`}
                accessibilityLabel={`Select ${method.label} payment method`}
              >
                <Ionicons
                  name={method.icon}
                  size={28}
                  color={selectedMethod === method.id ? method.color : '#757575'}
                />
                <Text
                  style={[
                    styles.methodLabel,
                    selectedMethod === method.id && styles.methodLabelSelected,
                  ]}
                >
                  {method.label}
                </Text>
                {selectedMethod === method.id && (
                  <View style={[styles.methodCheckmark, { backgroundColor: method.color }]}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note about this payment..."
            placeholderTextColor="#BDBDBD"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            testID="settlement-notes-input"
            accessibilityLabel="Settlement notes input"
          />
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmSettlement}
          disabled={processing}
          testID="confirm-settlement-button"
          accessibilityLabel="Confirm settlement"
        >
          <LinearGradient
            colors={processing ? ['#BDBDBD', '#9E9E9E'] : ['#2E7D32', '#1B5E20']}
            style={styles.confirmGradient}
          >
            {processing ? (
              <Text style={styles.confirmButtonText}>Processing...</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Mark as Paid</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <LinearGradient
                colors={['#2E7D32', '#1B5E20']}
                style={styles.successIconGradient}
              >
                <Ionicons name="checkmark-circle" size={64} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.successTitle}>Payment Recorded!</Text>
            <Text style={styles.successMessage}>
              ${settlementAmount.toFixed(2)} settled via {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label}
            </Text>

            <View style={styles.successDetails}>
              <View style={styles.successDetailRow}>
                <Ionicons name="person-outline" size={18} color="#757575" />
                <Text style={styles.successDetailText}>
                  {fromMember?.name} → {toMember?.name}
                </Text>
              </View>
              <View style={styles.successDetailRow}>
                <Ionicons name="calendar-outline" size={18} color="#757575" />
                <Text style={styles.successDetailText}>
                  {format(new Date(), 'MMM dd, yyyy h:mm a')}
                </Text>
              </View>
            </View>

            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShareReceipt}
                testID="share-receipt-button"
                accessibilityLabel="Share settlement receipt"
              >
                <Ionicons name="share-outline" size={20} color="#2E7D32" />
                <Text style={styles.shareButtonText}>Share Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneButton}
                onPress={handleClose}
                testID="close-success-modal-button"
                accessibilityLabel="Close and return"
              >
                <LinearGradient
                  colors={['#2E7D32', '#1B5E20']}
                  style={styles.doneGradient}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryGradient: {
    padding: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  memberFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  memberInfo: {
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 28,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  memberLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  arrowIcon: {
    marginHorizontal: 8,
  },
  amountContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  amountLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  partialLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  groupBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  partialToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  partialToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partialToggleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginLeft: 12,
  },
  partialInputContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  partialInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#757575',
    marginBottom: 8,
  },
  partialInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 4,
  },
  partialInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    paddingVertical: 12,
  },
  partialHint: {
    fontSize: 12,
    color: '#757575',
    marginTop: 6,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  methodCard: {
    width: (width - 48) / 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  methodCardSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#F1F8E9',
  },
  methodLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#757575',
    marginTop: 8,
    textAlign: 'center',
  },
  methodLabelSelected: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  methodCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 80,
  },
  confirmButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
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
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successIconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
  },
  successDetails: {
    width: '100%',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  successDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  successDetailText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginLeft: 12,
    flex: 1,
  },
  successActions: {
    width: '100%',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F8E9',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 8,
  },
  doneButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  doneGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
