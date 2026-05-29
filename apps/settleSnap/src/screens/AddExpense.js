import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { name: 'Food', icon: 'restaurant-outline', color: '#FF6B6B' },
  { name: 'Transportation', icon: 'car-outline', color: '#4ECDC4' },
  { name: 'Utilities', icon: 'flash-outline', color: '#95E1D3' },
  { name: 'Entertainment', icon: 'game-controller-outline', color: '#F38181' },
  { name: 'Accommodation', icon: 'bed-outline', color: '#AA96DA' },
  { name: 'Shopping', icon: 'cart-outline', color: '#FCBAD3' },
  { name: 'Other', icon: 'ellipsis-horizontal-outline', color: '#757575' },
];

const SPLIT_TYPES = [
  { id: 'equal', label: 'Splitting even', icon: 'people-outline' },
  { id: 'percentage', label: 'By Percentage', icon: 'pie-chart-outline' },
  { id: 'custom', label: 'Itemized chaos', icon: 'calculator-outline' },
];

export default function AddExpense({ route, navigation }) {
  const { groupId } = route?.params || {};
  
  const {
    groups,
    members,
    addExpense,
    currentUser,
  } = useSettleSnap();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [selectedGroup, setSelectedGroup] = useState(groupId || null);
  const [selectedPayer, setSelectedPayer] = useState(null);
  const [splitType, setSplitType] = useState('equal');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [customSplits, setCustomSplits] = useState({});
  const [percentageSplits, setPercentageSplits] = useState({});
  
  const [receiptImage, setReceiptImage] = useState(null);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentGroup = useMemo(() => {
    return (groups || []).find(g => g?.id === selectedGroup);
  }, [groups, selectedGroup]);

  const groupMembers = useMemo(() => {
    if (!currentGroup?.members) return [];
    return (currentGroup.members || [])
      .map(memberId => {
        const member = (members || []).find(m => m?.id === memberId);
        return member;
      })
      .filter(Boolean);
  }, [currentGroup, members]);

  useEffect(() => {
    if (groups && groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0]?.id);
    }
  }, [groups]);

  useEffect(() => {
    if (groupMembers.length > 0) {
      if (!selectedPayer) {
        setSelectedPayer(currentUser?.id || groupMembers[0]?.id);
      }
      if (selectedMembers.length === 0) {
        setSelectedMembers(groupMembers.map(m => m?.id));
      }
    }
  }, [groupMembers, currentUser]);

  useEffect(() => {
    if (splitType === 'equal') {
      setCustomSplits({});
      setPercentageSplits({});
    } else if (splitType === 'percentage') {
      const equalPercentage = selectedMembers.length > 0 ? (100 / selectedMembers.length).toFixed(2) : '0';
      const newPercentages = {};
      selectedMembers.forEach(memberId => {
        newPercentages[memberId] = equalPercentage;
      });
      setPercentageSplits(newPercentages);
      setCustomSplits({});
    } else if (splitType === 'custom') {
      const amountValue = parseFloat(amount) || 0;
      const equalAmount = selectedMembers.length > 0 ? (amountValue / selectedMembers.length).toFixed(2) : '0';
      const newCustom = {};
      selectedMembers.forEach(memberId => {
        newCustom[memberId] = equalAmount;
      });
      setCustomSplits(newCustom);
      setPercentageSplits({});
    }
  }, [splitType, selectedMembers.length]);

  const handleTakePhoto = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setReceiptImage(result.assets[0].uri);
        setShowImageOptions(false);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setReceiptImage(result.assets[0].uri);
        setShowImageOptions(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const toggleMemberSelection = (memberId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMembers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const handleCustomSplitChange = (memberId, value) => {
    setCustomSplits(prev => ({
      ...prev,
      [memberId]: value,
    }));
  };

  const handlePercentageChange = (memberId, value) => {
    setPercentageSplits(prev => ({
      ...prev,
      [memberId]: value,
    }));
  };

  const validateAndSave = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please enter a description');
      return;
    }

    if (!selectedGroup) {
      Alert.alert('No Group Selected', 'Please select a group');
      return;
    }

    if (!selectedPayer) {
      Alert.alert('No Payer Selected', 'Please select who paid');
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert('No Members Selected', 'Please select at least one member to split with');
      return;
    }

    if (splitType === 'percentage') {
      const totalPercentage = Object.values(percentageSplits).reduce((sum, val) => sum + parseFloat(val || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        Alert.alert('Invalid Percentages', `Percentages must add up to 100%. Current total: ${totalPercentage.toFixed(2)}%`);
        return;
      }
    }

    if (splitType === 'custom') {
      const totalCustom = Object.values(customSplits).reduce((sum, val) => sum + parseFloat(val || 0), 0);
      const amountValue = parseFloat(amount);
      if (Math.abs(totalCustom - amountValue) > 0.01) {
        Alert.alert('Invalid Custom Amounts', `Custom amounts must add up to ${amountValue.toFixed(2)}. Current total: ${totalCustom.toFixed(2)}`);
        return;
      }
    }

    handleSave();
  };

  const handleSave = async () => {
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const amountValue = parseFloat(amount);
    
    let splitWithData = [];
    if (splitType === 'equal') {
      splitWithData = selectedMembers.map(memberId => ({
        memberId,
        amount: amountValue / selectedMembers.length,
      }));
    } else if (splitType === 'percentage') {
      splitWithData = selectedMembers.map(memberId => ({
        memberId,
        amount: (amountValue * parseFloat(percentageSplits[memberId] || 0)) / 100,
      }));
    } else if (splitType === 'custom') {
      splitWithData = selectedMembers.map(memberId => ({
        memberId,
        amount: parseFloat(customSplits[memberId] || 0),
      }));
    }

    const newExpense = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      groupId: selectedGroup,
      description: description.trim(),
      amount: amountValue,
      paidBy: selectedPayer,
      splitWith: selectedMembers,
      splitType: splitType,
      splitData: splitWithData,
      createdAt: selectedDate.getTime(),
      category: selectedCategory,
      imageUri: receiptImage,
    };

    try {
      await addExpense(newExpense);
      setTimeout(() => {
        setSaving(false);
        navigation.goBack();
      }, 500);
    } catch (error) {
      setSaving(false);
      Alert.alert('Error', 'Failed to save expense');
    }
  };

  const totalCustomAmount = useMemo(() => {
    return Object.values(customSplits).reduce((sum, val) => sum + parseFloat(val || 0), 0);
  }, [customSplits]);

  const totalPercentage = useMemo(() => {
    return Object.values(percentageSplits).reduce((sum, val) => sum + parseFloat(val || 0), 0);
  }, [percentageSplits]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#BDBDBD"
              keyboardType="decimal-pad"
              testID="amount-input"
              accessibilityLabel="Expense amount input"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="What's the damage?"
            placeholderTextColor="#BDBDBD"
            testID="description-input"
            accessibilityLabel="Expense description input"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.name;
              return (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryChip,
                    isSelected && { backgroundColor: category.color },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCategory(category.name);
                  }}
                  testID={`category-${category.name.toLowerCase()}`}
                  accessibilityLabel={`Select ${category.name} category`}
                >
                  <Ionicons
                    name={category.icon}
                    size={20}
                    color={isSelected ? '#FFFFFF' : category.color}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      isSelected && styles.categoryTextSelected,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowDatePicker(true);
            }}
            testID="date-picker-button"
            accessibilityLabel="Select expense date"
          >
            <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
            <Text style={styles.dateText}>{format(selectedDate, 'MMM dd, yyyy')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupScroll}
          >
            {(groups || []).map((group) => {
              const isSelected = selectedGroup === group?.id;
              return (
                <TouchableOpacity
                  key={group?.id}
                  style={[
                    styles.groupChip,
                    isSelected && { backgroundColor: group?.color || '#2E7D32' },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedGroup(group?.id);
                  }}
                  testID={`group-${group?.id}`}
                  accessibilityLabel={`Select ${group?.name} group`}
                >
                  <Text
                    style={[
                      styles.groupChipText,
                      isSelected && styles.groupChipTextSelected,
                    ]}
                  >
                    {group?.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paid By</Text>
          <View style={styles.payerContainer}>
            {(groupMembers || []).map((member) => {
              const isSelected = selectedPayer === member?.id;
              return (
                <TouchableOpacity
                  key={member?.id}
                  style={styles.payerOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPayer(member?.id);
                  }}
                  testID={`payer-${member?.id}`}
                  accessibilityLabel={`Select ${member?.name} as payer`}
                >
                  <View style={styles.payerLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{member?.avatar || '👤'}</Text>
                    </View>
                    <Text style={styles.payerName}>{member?.name}</Text>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Split Method</Text>
          <View style={styles.splitTypeContainer}>
            {SPLIT_TYPES.map((type) => {
              const isSelected = splitType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.splitTypeButton,
                    isSelected && styles.splitTypeButtonSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSplitType(type.id);
                  }}
                  testID={`split-type-${type.id}`}
                  accessibilityLabel={`Select ${type.label} split method`}
                >
                  <Ionicons
                    name={type.icon}
                    size={24}
                    color={isSelected ? '#FFFFFF' : '#2E7D32'}
                  />
                  <Text
                    style={[
                      styles.splitTypeText,
                      isSelected && styles.splitTypeTextSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Split With</Text>
          <View style={styles.membersList}>
            {(groupMembers || []).map((member) => {
              const isSelected = selectedMembers.includes(member?.id);
              return (
                <View key={member?.id} style={styles.memberRow}>
                  <TouchableOpacity
                    style={styles.memberCheckbox}
                    onPress={() => toggleMemberSelection(member?.id)}
                    testID={`member-${member?.id}`}
                    accessibilityLabel={`Toggle ${member?.name} in split`}
                  >
                    <View style={styles.memberLeft}>
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
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{member?.avatar || '👤'}</Text>
                      </View>
                      <Text style={styles.memberName}>{member?.name}</Text>
                    </View>
                  </TouchableOpacity>

                  {isSelected && splitType === 'custom' && (
                    <View style={styles.customAmountInput}>
                      <Text style={styles.currencySymbolSmall}>$</Text>
                      <TextInput
                        style={styles.customInput}
                        value={customSplits[member?.id] || ''}
                        onChangeText={(value) => handleCustomSplitChange(member?.id, value)}
                        placeholder="0.00"
                        placeholderTextColor="#BDBDBD"
                        keyboardType="decimal-pad"
                        testID={`custom-amount-${member?.id}`}
                        accessibilityLabel={`Custom amount for ${member?.name}`}
                      />
                    </View>
                  )}

                  {isSelected && splitType === 'percentage' && (
                    <View style={styles.percentageInput}>
                      <TextInput
                        style={styles.percentInput}
                        value={percentageSplits[member?.id] || ''}
                        onChangeText={(value) => handlePercentageChange(member?.id, value)}
                        placeholder="0"
                        placeholderTextColor="#BDBDBD"
                        keyboardType="decimal-pad"
                        testID={`percentage-${member?.id}`}
                        accessibilityLabel={`Percentage for ${member?.name}`}
                      />
                      <Text style={styles.percentSymbol}>%</Text>
                    </View>
                  )}

                  {isSelected && splitType === 'equal' && (
                    <Text style={styles.equalAmount}>
                      ${amount ? (parseFloat(amount) / selectedMembers.length).toFixed(2) : '0.00'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {splitType === 'custom' && selectedMembers.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text
                style={[
                  styles.totalAmount,
                  Math.abs(totalCustomAmount - parseFloat(amount || 0)) > 0.01 && styles.totalAmountError,
                ]}
              >
                ${totalCustomAmount.toFixed(2)} / ${parseFloat(amount || 0).toFixed(2)}
              </Text>
            </View>
          )}

          {splitType === 'percentage' && selectedMembers.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text
                style={[
                  styles.totalAmount,
                  Math.abs(totalPercentage - 100) > 0.01 && styles.totalAmountError,
                ]}
              >
                {total