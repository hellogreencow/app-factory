import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { useSettleSnap } from '../context/AppContext';

const { width } = Dimensions.get('window');

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

export default function Circles({ navigation }) {
  const {
    groups,
    members,
    expenses,
    addGroup,
    deleteGroup,
    groupBalances,
  } = useSettleSnap();

  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert('Error', 'Please select at least one member');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newGroup = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: groupName.trim(),
      members: selectedMembers,
      createdAt: Date.now(),
      color: selectedColor,
    };

    addGroup(newGroup);
    setModalVisible(false);
    setGroupName('');
    setSelectedMembers([]);
    setSelectedColor(PRESET_COLORS[0]);
  };

  const toggleMemberSelection = (memberId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const getGroupMembers = (group) => {
    if (!group?.members) return [];
    return (group.members || [])
      .map((memberId) => {
        const member = (members || []).find((m) => m?.id === memberId);
        return member;
      })
      .filter(Boolean);
  };

  const getGroupBalance = (groupId) => {
    const groupExpenses = (expenses || []).filter((exp) => exp?.groupId === groupId);
    return groupExpenses.reduce((sum, exp) => sum + (exp?.amount || 0), 0);
  };

  const handleGroupPress = (groupId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('GroupDetail', { groupId });
  };

  const renderGroupCard = ({ item }) => {
    const groupMembers = getGroupMembers(item);
    const balance = getGroupBalance(item?.id);
    const createdDate = item?.createdAt ? new Date(item.createdAt) : new Date();
    const safeDate = isNaN(createdDate.getTime()) ? new Date() : createdDate;

    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => handleGroupPress(item?.id)}
        testID={`group-card-${item?.id}`}
        accessibilityLabel={`Group ${item?.name || 'Unnamed'}`}
        activeOpacity={0.7}
      >
        <View style={[styles.colorAccent, { backgroundColor: item?.color || '#2E7D32' }]} />
        <View style={styles.groupCardContent}>
          <View style={styles.groupHeader}>
            <View style={styles.groupTitleRow}>
              <Ionicons name="people" size={24} color={item?.color || '#2E7D32'} />
              <Text style={styles.groupName} numberOfLines={1}>
                {item?.name || 'Unnamed Group'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#757575" />
          </View>

          <View style={styles.memberAvatars}>
            {(groupMembers || []).slice(0, 5).map((member, index) => (
              <View
                key={member?.id || index}
                style={[styles.avatar, { marginLeft: index > 0 ? -8 : 0 }]}
              >
                <Text style={styles.avatarText}>{member?.avatar || '👤'}</Text>
              </View>
            ))}
            {groupMembers.length > 5 && (
              <View style={[styles.avatar, styles.moreAvatar, { marginLeft: -8 }]}>
                <Text style={styles.moreAvatarText}>+{groupMembers.length - 5}</Text>
              </View>
            )}
          </View>

          <View style={styles.groupFooter}>
            <View style={styles.memberCount}>
              <Ionicons name="person-outline" size={16} color="#757575" />
              <Text style={styles.memberCountText}>
                {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <View style={styles.balanceContainer}>
              <Ionicons name="cash-outline" size={16} color="#2E7D32" />
              <Text style={styles.balanceText}>${balance.toFixed(2)}</Text>
            </View>
          </View>

          <Text style={styles.createdText}>
            Created {formatDistanceToNow(safeDate, { addSuffix: true })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={['#E8F5E9', '#FAFAFA']}
        style={styles.emptyGradient}
      >
        <Ionicons name="people-outline" size={80} color="#2E7D32" />
        <Text style={styles.emptyTitle}>No Groups Yet</Text>
        <Text style={styles.emptyText}>
          Create your first group to start tracking shared expenses with friends and family
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setModalVisible(true);
          }}
          testID="empty-create-group-button"
          accessibilityLabel="Create your first group"
        >
          <LinearGradient
            colors={['#2E7D32', '#1B5E20']}
            style={styles.emptyButtonGradient}
          >
            <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>Create Group</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setModalVisible(true);
          }}
          testID="add-group-button"
          accessibilityLabel="Add new group"
        >
          <LinearGradient
            colors={['#2E7D32', '#1B5E20']}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups || []}
        renderItem={renderGroupCard}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        contentContainerStyle={[
          styles.listContent,
          (!groups || groups.length === 0) && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        testID="groups-list"
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalVisible(false);
                }}
                testID="close-modal-button"
                accessibilityLabel="Close modal"
              >
                <Ionicons name="close" size={28} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Group Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Weekend Trip, Roommates"
                  placeholderTextColor="#757575"
                  value={groupName}
                  onChangeText={setGroupName}
                  testID="group-name-input"
                  accessibilityLabel="Group name input"
                />
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Group Color</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colorPicker}
                >
                  {PRESET_COLORS.map((color) => (
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
                </ScrollView>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Select Members</Text>
                <View style={styles.membersList}>
                  {(members || []).map((member) => (
                    <TouchableOpacity
                      key={member?.id}
                      style={[
                        styles.memberOption,
                        selectedMembers.includes(member?.id) && styles.memberOptionSelected,
                      ]}
                      onPress={() => toggleMemberSelection(member?.id)}
                      testID={`member-option-${member?.id}`}
                      accessibilityLabel={`Select member ${member?.name || 'Unknown'}`}
                    >
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberAvatar}>{member?.avatar || '👤'}</Text>
                        <View style={styles.memberDetails}>
                          <Text style={styles.memberName}>{member?.name || 'Unknown'}</Text>
                          <Text style={styles.memberEmail}>{member?.email || ''}</Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          selectedMembers.includes(member?.id) && styles.checkboxSelected,
                        ]}
                      >
                        {selectedMembers.includes(member?.id) && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalVisible(false);
                }}
                testID="cancel-button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateGroup}
                testID="create-group-button"
                accessibilityLabel="Create group"
              >
                <LinearGradient
                  colors={['#2E7D32', '#1B5E20']}
                  style={styles.createButtonGradient}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Create Group</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  colorAccent: {
    height: 6,
    width: '100%',
  },
  groupCardContent: {
    padding: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
    flex: 1,
  },
  memberAvatars: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 18,
  },
  moreAvatar: {
    backgroundColor: '#757575',
  },
  moreAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCountText: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 4,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 4,
  },
  createdText: {
    fontSize: 12,
    color: '#757575',
  },
  emptyState: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalContent: {
    padding: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  colorPicker: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#1A1A1A',
    borderWidth: 3,
  },
  membersList: {
    gap: 12,
  },
  memberOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    fontSize: 32,
    marginRight: 12,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  memberEmail: {
    fontSize: 14,
    color: '#757575',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#757575',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#757575',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  createButton: {