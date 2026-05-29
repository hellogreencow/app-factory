import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { Swipeable } from 'react-native-gesture-handler';
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

export default function GroupsScreen({ navigation }) {
  const {
    groups,
    expenses,
    members,
    addGroup,
    deleteGroup,
    groupBalances,
  } = useSettleSnap();

  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

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

  const handleDeleteGroup = (groupId) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleteConfirmId(groupId);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      deleteGroup(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const toggleMemberSelection = (memberId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const getGroupExpenses = (groupId) => {
    return (expenses || []).filter((exp) => exp.groupId === groupId);
  };

  const getGroupTotalExpenses = (groupId) => {
    const groupExpenses = getGroupExpenses(groupId);
    return groupExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  };

  const getGroupMembers = (group) => {
    if (!group?.members) return [];
    return group.members
      .map((memberId) => {
        const member = (members || []).find((m) => m.id === memberId);
        return member;
      })
      .filter(Boolean);
  };

  const renderDeleteAction = (groupId) => {
    return (
      <View style={styles.deleteAction}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteGroup(groupId)}
          testID={`delete-group-${groupId}`}
          accessibilityLabel={`Delete group ${groupId}`}
        >
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderGroupCard = (group) => {
    const groupMembers = getGroupMembers(group);
    const totalExpenses = getGroupTotalExpenses(group.id);
    const balance = groupBalances?.[group.id] || {};
    
    const createdDate = new Date(group.createdAt);
    const safeCreatedDate = isNaN(createdDate.getTime()) ? new Date() : createdDate;

    return (
      <Swipeable
        key={group.id}
        renderRightActions={() => renderDeleteAction(group.id)}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={styles.groupCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('GroupDetail', { groupId: group.id });
          }}
          testID={`group-card-${group.id}`}
          accessibilityLabel={`Group ${group.name}`}
        >
          <View style={styles.groupCardContent}>
            <View style={styles.groupHeader}>
              <View style={[styles.colorIndicator, { backgroundColor: group.color }]} />
              <View style={styles.groupInfo}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {group.name}
                </Text>
                <Text style={styles.groupMeta}>
                  {formatDistanceToNow(safeCreatedDate, { addSuffix: true })}
                </Text>
              </View>
            </View>

            <View style={styles.groupStats}>
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={16} color="#4A5568" />
                <Text style={styles.statText}>{groupMembers.length} members</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="receipt-outline" size={16} color="#4A5568" />
                <Text style={styles.statText}>
                  {getGroupExpenses(group.id).length} expenses
                </Text>
              </View>
            </View>

            <View style={styles.groupSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Spent</Text>
                <Text style={styles.summaryAmount}>
                  ${totalExpenses.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.memberAvatars}>
              {groupMembers.slice(0, 4).map((member, index) => (
                <View
                  key={member.id}
                  style={[styles.avatarContainer, { marginLeft: index > 0 ? -8 : 0 }]}
                >
                  <Text style={styles.avatar}>{member.avatar || '👤'}</Text>
                </View>
              ))}
              {groupMembers.length > 4 && (
                <View style={[styles.avatarContainer, { marginLeft: -8 }]}>
                  <View style={styles.avatarMore}>
                    <Text style={styles.avatarMoreText}>
                      +{groupMembers.length - 4}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#A0AEC0" />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {(groups || []).length === 0 ? (
          <View style={styles.emptyState} testID="empty-state">
            <Ionicons name="people-outline" size={80} color="#CBD5E0" />
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptyText}>
              Create your first group to start tracking shared expenses
            </Text>
          </View>
        ) : (
          <View style={styles.groupList}>
            {(groups || []).map((group) => renderGroupCard(group))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setModalVisible(true);
        }}
        testID="create-group-fab"
        accessibilityLabel="Create new group"
      >
        <LinearGradient
          colors={['#2D3748', '#4A5568']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalVisible(false);
                }}
                testID="close-modal"
                accessibilityLabel="Close modal"
              >
                <Ionicons name="close" size={28} color="#4A5568" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <Text style={styles.label}>Group Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Weekend Trip, Roommates"
                  placeholderTextColor="#A0AEC0"
                  value={groupName}
                  onChangeText={setGroupName}
                  testID="group-name-input"
                  accessibilityLabel="Group name input"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Group Color</Text>
                <View style={styles.colorGrid}>
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
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>
                  Select Members ({selectedMembers.length})
                </Text>
                <View style={styles.memberList}>
                  {(members || []).map((member) => {
                    const isSelected = selectedMembers.includes(member.id);
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.memberItem,
                          isSelected && styles.memberItemSelected,
                        ]}
                        onPress={() => toggleMemberSelection(member.id)}
                        testID={`member-option-${member.id}`}
                        accessibilityLabel={`Select member ${member.name}`}
                      >
                        <View style={styles.memberLeft}>
                          <Text style={styles.memberAvatar}>
                            {member.avatar || '👤'}
                          </Text>
                          <View>
                            <Text style={styles.memberName}>{member.name}</Text>
                            <Text style={styles.memberEmail}>{member.email}</Text>
                          </View>
                        </View>
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
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateGroup}
                testID="create-group-button"
                accessibilityLabel="Create group"
              >
                <LinearGradient
                  colors={['#2D3748', '#4A5568']}
                  style={styles.createButtonGradient}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Create Group</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteConfirmId !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteConfirmId(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Ionicons name="warning-outline" size={48} color="#F38181" />
            <Text style={styles.confirmTitle}>Delete Group?</Text>
            <Text style={styles.confirmText}>
              This will permanently delete the group and all its expenses.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmButtonCancel}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDeleteConfirmId(null);
                }}
                testID="cancel-delete"
                accessibilityLabel="Cancel delete"
              >
                <Text style={styles.confirmButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButtonDelete}
                onPress={confirmDelete}
                testID="confirm-delete"
                accessibilityLabel="Confirm delete"
              >
                <Text style={styles.confirmButtonDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
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
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
  },
  groupList: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  groupCardContent: {
    flex: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
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
  groupMeta: {
    fontSize: 13,
    color: '#718096',
  },
  groupStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#4A5568',
  },
  groupSummary: {
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
  },
  memberAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    fontSize: 18,
  },
  avatarMore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4A5568',
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  deleteButton: {
    backgroundColor: '#F38181',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '90%',
    borderRadius: 12,
    gap: 4,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  memberList: {
    gap: 8,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberItemSelected: {
    backgroundColor: '#EDF2F7',
    borderColor: '#2D3748',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberAvatar: {
    fontSize: 32,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  memberEmail: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2D3748',
    borderColor: '#2D3748',
  },
  createButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 15,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButtonCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  confirmButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  confirmButtonDelete: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F38181',
    alignItems: 'center',
  },
  confirmButtonDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
