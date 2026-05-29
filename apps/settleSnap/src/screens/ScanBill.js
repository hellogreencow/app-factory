import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useSettleSnap } from '../context/AppContext';

export default function ScanBill({ navigation }) {
  const {
    groups,
    members,
    addExpense,
    currentUser,
  } = useSettleSnap();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [capturedImage, setCapturedImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [splitType, setSplitType] = useState('equal');
  const [customSplits, setCustomSplits] = useState({});
  const [showManualEntry, setShowManualEntry] = useState(false);

  const cameraRef = useRef(null);

  useEffect(() => {
    if (groups && groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0].id);
    }
  }, [groups]);

  useEffect(() => {
    if (selectedGroup) {
      const group = groups?.find(g => g.id === selectedGroup);
      if (group?.members) {
        setSelectedMembers(group.members.map(m => m.id || m));
      }
    }
  }, [selectedGroup, groups]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#757575" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            SettleSnap needs camera access to scan receipts
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            testID="request-camera-permission"
            accessibilityLabel="Grant camera permission"
          >
            <LinearGradient
              colors={['#2E7D32', '#1B5E20']}
              style={styles.gradientButton}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualEntryLink}
            onPress={() => {
              setShowManualEntry(true);
              setCapturedImage('manual');
            }}
            testID="skip-to-manual-entry"
            accessibilityLabel="Skip to manual entry"
          >
            <Text style={styles.manualEntryLinkText}>Enter Manually Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });
        setCapturedImage(photo.uri);
        setProcessing(true);
        
        // Simulate OCR processing
        setTimeout(() => {
          // Mock extracted data
          const mockAmount = (Math.random() * 100 + 10).toFixed(2);
          const mockDescriptions = [
            'Grocery Shopping',
            'Restaurant Dinner',
            'Coffee & Snacks',
            'Gas Station',
            'Pharmacy',
          ];
          setAmount(mockAmount);
          setDescription(mockDescriptions[Math.floor(Math.random() * mockDescriptions.length)]);
          setProcessing(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 1500);
      } catch (error) {
        Alert.alert('Error', 'Failed to capture image');
        setProcessing(false);
      }
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCapturedImage(result.assets[0].uri);
        setProcessing(true);
        
        setTimeout(() => {
          const mockAmount = (Math.random() * 100 + 10).toFixed(2);
          setAmount(mockAmount);
          setDescription('Scanned Receipt');
          setProcessing(false);
        }, 1500);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const toggleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const handleRetake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedImage(null);
    setAmount('');
    setDescription('');
    setShowManualEntry(false);
  };

  const toggleMemberSelection = (memberId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMembers(current => {
      if (current.includes(memberId)) {
        return current.filter(id => id !== memberId);
      } else {
        return [...current, memberId];
      }
    });
  };

  const calculateSplitAmounts = () => {
    const totalAmount = parseFloat(amount) || 0;
    const splitCount = selectedMembers.length;
    
    if (splitType === 'equal' && splitCount > 0) {
      const perPerson = totalAmount / splitCount;
      const splits = {};
      selectedMembers.forEach(memberId => {
        splits[memberId] = perPerson;
      });
      return splits;
    } else if (splitType === 'custom') {
      return customSplits;
    }
    return {};
  };

  const handleSaveExpense = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (!description || description.trim() === '') {
      Alert.alert('Missing Description', 'Please enter a description');
      return;
    }

    if (!selectedGroup) {
      Alert.alert('No Group Selected', 'Please select a group');
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert('No Members Selected', 'Please select at least one member to split with');
      return;
    }

    const splits = calculateSplitAmounts();
    const totalSplit = Object.values(splits).reduce((sum, val) => sum + val, 0);
    const amountNum = parseFloat(amount);

    if (splitType === 'custom' && Math.abs(totalSplit - amountNum) > 0.01) {
      Alert.alert('Split Mismatch', `Custom splits must equal the total amount (${amountNum.toFixed(2)})`);
      return;
    }

    const newExpense = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      groupId: selectedGroup,
      description: description.trim(),
      amount: amountNum,
      paidBy: currentUser?.id || 'user-1',
      splitWith: selectedMembers.map(memberId => ({
        memberId,
        amount: splits[memberId] || 0,
      })),
      date: date.getTime(),
      category: 'General',
      imageUri: capturedImage !== 'manual' ? capturedImage : null,
    };

    addExpense(newExpense);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    Alert.alert(
      'Expense Added',
      `${description} - $${amountNum.toFixed(2)} added successfully`,
      [
        {
          text: 'View Expenses',
          onPress: () => navigation.navigate('Expenses'),
        },
        {
          text: 'Scan Another',
          onPress: () => {
            setCapturedImage(null);
            setAmount('');
            setDescription('');
            setShowManualEntry(false);
            setSelectedMembers([]);
          },
        },
      ]
    );
  };

  const getGroupMembers = () => {
    if (!selectedGroup) return [];
    const group = groups?.find(g => g.id === selectedGroup);
    return group?.members || [];
  };

  const getMemberName = (memberId) => {
    const member = members?.find(m => m.id === memberId);
    return member?.name || 'Unknown';
  };

  if (capturedImage) {
    const groupMembers = getGroupMembers();
    const splits = calculateSplitAmounts();

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.previewContainer} contentContainerStyle={styles.previewContent}>
          {/* Header */}
          <View style={styles.previewHeader}>
            <TouchableOpacity
              onPress={handleRetake}
              style={styles.headerButton}
              testID="retake-button"
              accessibilityLabel="Retake photo"
            >
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Review & Split</Text>
            <View style={styles.headerButton} />
          </View>

          {/* Image Preview */}
          {capturedImage !== 'manual' && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
              {processing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.processingText}>Extracting data...</Text>
                </View>
              )}
            </View>
          )}

          {/* Expense Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Expense Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#757575"
                  testID="amount-input"
                  accessibilityLabel="Expense amount"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="What was this for?"
                placeholderTextColor="#757575"
                testID="description-input"
                accessibilityLabel="Expense description"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date</Text>
              <View style={styles.dateDisplay}>
                <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
                <Text style={styles.dateText}>{format(date, 'MMM dd, yyyy')}</Text>
              </View>
            </View>
          </View>

          {/* Group Selection */}
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Select Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
              {(groups || []).map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupChip,
                    selectedGroup === group.id && styles.groupChipSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedGroup(group.id);
                  }}
                  testID={`group-chip-${group.id}`}
                  accessibilityLabel={`Select group ${group.name}`}
                >
                  <View
                    style={[
                      styles.groupColorDot,
                      { backgroundColor: group.color || '#2E7D32' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.groupChipText,
                      selectedGroup === group.id && styles.groupChipTextSelected,
                    ]}
                  >
                    {group.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Split Options */}
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Split With</Text>
            
            <View style={styles.splitTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.splitTypeButton,
                  splitType === 'equal' && styles.splitTypeButtonActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSplitType('equal');
                }}
                testID="split-type-equal"
                accessibilityLabel="Split equally"
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color={splitType === 'equal' ? '#FFFFFF' : '#2E7D32'}
                />
                <Text
                  style={[
                    styles.splitTypeText,
                    splitType === 'equal' && styles.splitTypeTextActive,
                  ]}
                >
                  Equal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.splitTypeButton,
                  splitType === 'custom' && styles.splitTypeButtonActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSplitType('custom');
                }}
                testID="split-type-custom"
                accessibilityLabel="Custom split"
              >
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={splitType === 'custom' ? '#FFFFFF' : '#2E7D32'}
                />
                <Text
                  style={[
                    styles.splitTypeText,
                    splitType === 'custom' && styles.splitTypeTextActive,
                  ]}
                >
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {groupMembers.map(member => {
              const memberId = member.id || member;
              const isSelected = selectedMembers.includes(memberId);
              const splitAmount = splits[memberId] || 0;

              return (
                <View key={memberId} style={styles.memberRow}>
                  <TouchableOpacity
                    style={styles.memberCheckbox}
                    onPress={() => toggleMemberSelection(memberId)}
                    testID={`member-checkbox-${memberId}`}
                    accessibilityLabel={`Toggle ${getMemberName(memberId)}`}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={styles.memberName}>{getMemberName(memberId)}</Text>
                  </TouchableOpacity>

                  {isSelected && (
                    <View style={styles.memberSplitAmount}>
                      {splitType === 'equal' ? (
                        <Text style={styles.splitAmountText}>
                          ${splitAmount.toFixed(2)}
                        </Text>
                      ) : (
                        <View style={styles.customSplitInput}>
                          <Text style={styles.currencySymbolSmall}>$</Text>
                          <TextInput
                            style={styles.customAmountInput}
                            value={customSplits[memberId]?.toString() || ''}
                            onChangeText={(text) => {
                              const value = parseFloat(text) || 0;
                              setCustomSplits(prev => ({
                                ...prev,
                                [memberId]: value,
                              }));
                            }}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#757575"
                            testID={`custom-split-${memberId}`}
                            accessibilityLabel={`Custom amount for ${getMemberName(memberId)}`}
                          />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveExpense}
            testID="save-expense-button"
            accessibilityLabel="Save expense"
          >
            <LinearGradient
              colors={['#2E7D32', '#1B5E20']}
              style={styles.saveButtonGradient}
            >
              <Ionicons name="checkmark-circle-outline" size={24} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Expense</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        flash={flash}
        ref={cameraRef}
      >
        {/* Grid Overlay */}
        <View style={styles.gridOverlay}>
          <View style={styles.gridLine} />
          <View style={[styles.gridLine, styles.gridLineVertical]} />
        </View>

        {/* Header Controls */}
        <View style={styles.cameraHeader}>
          <TouchableOpacity
            style={styles.cameraHeaderButton}
            onPress={() => navigation.goBack()}
            testID="close-camera-button"
            accessibilityLabel="Close camera"
          >
            <View style={styles.iconBackground}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cameraHeaderButton}
            onPress={toggleFlash}
            testID="toggle-flash-button"
            accessibilityLabel={`Flash ${flash === 'on' ? 'on' : 'off'}`}
          >
            <View style={styles.iconBackground}>
              <Ionicons
                name={flash === 'on' ? 'flash' : 'flash-off'}
                size={24}
                color={flash === 'on' ? '#FFD700' : '#FFFFFF'}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <View style={styles.instructionsCard}>
            <Ionicons name="receipt-outline" size={32} color="#2E7D32" />
            <Text style={styles.instructionsText}>
              Position receipt within frame
            </Text>
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.cameraFooter}>
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={handlePickImage}
            testID="pick-image-button"
            accessibilityLabel="Pick image from gallery"
          >
            <View style={styles.iconBackground}>
              <Ionicons name="images-outline" size={28} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            testID="capture-button"
            accessibilityLabel="Capture photo"
          >
            <View style={styles.captureButtonOuter}>
              <View style={styles.captureButtonInner} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowManualEntry(true);
              setCapturedImage('manual');
            }}
            testID="manual-entry-button"
            accessibilityLabel="Enter manually"
          >
            <View style={styles.iconBackground}>
              <Ionicons name="create-outline" size={28} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLine: {
    position: 'absolute',
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255,