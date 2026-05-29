import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Switch,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64;
const CHART_HEIGHT = 200;

const CATEGORIES = [
  { name: 'Food', icon: 'restaurant-outline', color: '#FF6B6B' },
  { name: 'Transportation', icon: 'car-outline', color: '#4ECDC4' },
  { name: 'Utilities', icon: 'flash-outline', color: '#95E1D3' },
  { name: 'Entertainment', icon: 'game-controller-outline', color: '#F38181' },
  { name: 'Accommodation', icon: 'bed-outline', color: '#AA96DA' },
  { name: 'Shopping', icon: 'cart-outline', color: '#FCBAD3' },
  { name: 'Other', icon: 'ellipsis-horizontal-outline', color: '#757575' },
];

export default function Profile({ navigation }) {
  const {
    currentUser,
    updateProfile,
    expenses,
    categoryBreakdown,
    totalSpending,
  } = useSettleSnap();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadSettings();
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setAvatar(currentUser.avatar || '');
    }
  }, [currentUser]);

  const loadSettings = async () => {
    try {
      const notifications = await AsyncStorage.getItem('@settlesnap_notifications');
      const reminders = await AsyncStorage.getItem('@settlesnap_reminders');
      if (notifications !== null) setNotificationsEnabled(JSON.parse(notifications));
      if (reminders !== null) setRemindersEnabled(JSON.parse(reminders));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleNotificationsToggle = (value) => {
    setNotificationsEnabled(value);
    saveSettings('@settlesnap_notifications', value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemindersToggle = (value) => {
    setRemindersEnabled(value);
    saveSettings('@settlesnap_reminders', value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setAvatar(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      await updateProfile({ name: name.trim(), email: email.trim(), avatar });
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const monthExpenses = (expenses || []).filter(expense => {
      const expenseDate = new Date(expense.date || expense.createdAt);
      if (isNaN(expenseDate.getTime())) return false;
      return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
    });

    const categoryTotals = {};
    monthExpenses.forEach(expense => {
      const category = expense.category || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + (expense.amount || 0);
    });

    return categoryTotals;
  }, [expenses]);

  const maxCategoryAmount = useMemo(() => {
    const amounts = Object.values(monthlyStats);
    return amounts.length > 0 ? Math.max(...amounts) : 0;
  }, [monthlyStats]);

  const exportToCSV = async () => {
    setExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const csvHeader = 'Date,Description,Amount,Category,Group,Paid By\n';
      const csvRows = (expenses || []).map(expense => {
        const expenseDate = new Date(expense.date || expense.createdAt);
        const dateStr = isNaN(expenseDate.getTime()) ? 'N/A' : format(expenseDate, 'yyyy-MM-dd');
        return `${dateStr},"${expense.description || 'N/A'}",${expense.amount || 0},"${expense.category || 'Other'}","${expense.groupId || 'N/A'}","${expense.paidBy || 'N/A'}"`;
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      Alert.alert(
        'Export Data',
        'Choose export method',
        [
          {
            text: 'Copy to Clipboard',
            onPress: async () => {
              await Clipboard.setStringAsync(csvContent);
              Alert.alert('Success', 'Expense data copied to clipboard');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
          {
            text: 'Share as File',
            onPress: async () => {
              try {
                const fileUri = FileSystem.documentDirectory + 'settlesnap_expenses.csv';
                await FileSystem.writeAsStringAsync(fileUri, csvContent);
                
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(fileUri);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                  Alert.alert('Error', 'Sharing is not available on this device');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to share file');
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const renderBarChart = () => {
    if (Object.keys(monthlyStats).length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Ionicons name="bar-chart-outline" size={48} color="#757575" />
          <Text style={styles.emptyChartText}>No expenses this month</Text>
        </View>
      );
    }

    const barWidth = (CHART_WIDTH - 40) / Object.keys(monthlyStats).length - 10;
    const maxBarHeight = CHART_HEIGHT - 60;

    return (
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {Object.entries(monthlyStats).map(([category, amount], index) => {
          const barHeight = maxCategoryAmount > 0 ? (amount / maxCategoryAmount) * maxBarHeight : 0;
          const x = 20 + index * (barWidth + 10);
          const y = CHART_HEIGHT - barHeight - 30;
          const categoryColor = CATEGORIES.find(c => c.name === category)?.color || '#757575';

          return (
            <React.Fragment key={category}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={categoryColor}
                rx={4}
              />
              <SvgText
                x={x + barWidth / 2}
                y={y - 5}
                fontSize="10"
                fill="#1A1A1A"
                textAnchor="middle"
                fontWeight="600"
              >
                ${amount.toFixed(0)}
              </SvgText>
              <SvgText
                x={x + barWidth / 2}
                y={CHART_HEIGHT - 10}
                fontSize="9"
                fill="#757575"
                textAnchor="middle"
              >
                {category.slice(0, 6)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <LinearGradient
        colors={['#2E7D32', '#1B5E20']}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={editing ? pickImage : null}
          disabled={!editing}
          testID="avatar-button"
          accessibilityLabel="Change profile picture"
        >
          {avatar && avatar.startsWith('http') || avatar.startsWith('file') ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarEmoji}>{avatar || '👤'}</Text>
            </View>
          )}
          {editing && (
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {editing ? (
          <View style={styles.editForm}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#A5D6A7"
              testID="name-input"
              accessibilityLabel="Name input field"
            />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor="#A5D6A7"
              keyboardType="email-address"
              autoCapitalize="none"
              testID="email-input"
              accessibilityLabel="Email input field"
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditing(false);
                  setName(currentUser?.name || '');
                  setEmail(currentUser?.email || '');
                  setAvatar(currentUser?.avatar || '');
                }}
                testID="cancel-edit-button"
                accessibilityLabel="Cancel editing"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
                testID="save-profile-button"
                accessibilityLabel="Save profile changes"
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{name || 'Your Name'}</Text>
            <Text style={styles.userEmail}>{email || 'email@example.com'}</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setEditing(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              testID="edit-profile-button"
              accessibilityLabel="Edit profile"
            >
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Ionicons name="stats-chart-outline" size={24} color="#2E7D32" />
          <Text style={styles.statsTitle}>Monthly Spending</Text>
        </View>
        <Text style={styles.statsSubtitle}>{format(new Date(), 'MMMM yyyy')}</Text>
        <View style={styles.chartContainer}>
          {renderBarChart()}
        </View>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total this month</Text>
          <Text style={styles.totalAmount}>
            ${Object.values(monthlyStats).reduce((sum, val) => sum + val, 0).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications-outline" size={24} color="#2E7D32" />
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="alert-circle-outline" size={20} color="#757575" />
            <Text style={styles.settingLabel}>Expense Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            trackColor={{ false: '#E0E0E0', true: '#81C784' }}
            thumbColor={notificationsEnabled ? '#2E7D32' : '#BDBDBD'}
            testID="notifications-toggle"
            accessibilityLabel="Toggle expense notifications"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="time-outline" size={20} color="#757575" />
            <Text style={styles.settingLabel}>Payment Reminders</Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={handleRemindersToggle}
            trackColor={{ false: '#E0E0E0', true: '#81C784' }}
            thumbColor={remindersEnabled ? '#2E7D32' : '#BDBDBD'}
            testID="reminders-toggle"
            accessibilityLabel="Toggle payment reminders"
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="download-outline" size={24} color="#2E7D32" />
          <Text style={styles.sectionTitle}>Data Export</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Export your expense history as CSV for backup or analysis
        </Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={exportToCSV}
          disabled={exporting}
          testID="export-data-button"
          accessibilityLabel="Export expense data"
        >
          <LinearGradient
            colors={['#2E7D32', '#1B5E20']}
            style={styles.exportGradient}
          >
            {exporting ? (
              <Text style={styles.exportButtonText}>Exporting...</Text>
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                <Text style={styles.exportButtonText}>Export Expense Data</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.categoryLegend}>
        <Text style={styles.legendTitle}>Categories</Text>
        <View style={styles.legendGrid}>
          {CATEGORIES.map(category => (
            <View key={category.name} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: category.color }]} />
              <Ionicons name={category.icon} size={16} color="#757575" />
              <Text style={styles.legendText}>{category.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  header: {
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarEmoji: {
    fontSize: 48,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1B5E20',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#C8E6C9',
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  editForm: {
    width: '100%',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '700',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statsSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  emptyChart: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    marginTop: 12,
    fontSize: 14,
    color: '#757575',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16