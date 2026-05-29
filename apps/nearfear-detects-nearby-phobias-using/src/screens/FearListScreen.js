import React, { useContext, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFears } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';

const FearListScreen = () => {
  const { fears, addFear, deleteFear, theme } = useFears();
  const [modalVisible, setModalVisible] = useState(false);
  const [newFearName, setNewFearName] = useState('');
  const [newFearDescription, setNewFearDescription] = useState('');

  const handleAddFear = () => {
    if (newFearName.trim() === '') {
      Alert.alert('Error', 'Fear name cannot be empty.');
      return;
    }

    const newFear = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: newFearName,
      description: newFearDescription,
      location: { latitude: 0, longitude: 0 },
      sensorData: {},
      severity: 5,
    };

    addFear(newFear);
    setModalVisible(false);
    setNewFearName('');
    setNewFearDescription('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteFear = (id) => {
    Alert.alert(
      'Delete Fear',
      'Are you sure you want to delete this fear?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: () => {
            deleteFear(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );
  };

  const renderItem = ({ item }) => {
    const createdAt = item.id.substring(0, 13);
    let timeAgo = 'N/A';
    try {
      const d = new Date(parseInt(createdAt, 36));
      const safe = isNaN(d.getTime()) ? new Date() : d;
      timeAgo = formatDistanceToNow(safe, { addSuffix: true });
    } catch (e) {
      console.error('Error formatting date:', e);
    }

    return (
      <View style={[styles.card, { backgroundColor: theme.cardColor }]} testID={`fear-item-${item.id}`}>
        <View style={styles.cardHeader}>
          <Text style={[styles.fearName, { color: theme.textColor }]} testID={`fear-name-${item.id}`}>
            {item?.name ?? 'Unknown'}
          </Text>
          <Text style={[styles.fearTime, { color: theme.secondaryAccent }]}>
            {timeAgo}
          </Text>
        </View>
        <Text style={[styles.fearDescription, { color: theme.textColor }]} testID={`fear-description-${item.id}`}>
          {item?.description ?? 'No description'}
        </Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteFear(item.id)}
            testID={`delete-fear-${item.id}`}
            accessibilityLabel={`Delete ${item?.name ?? 'fear'}`}
          >
            <Ionicons name="trash" size={24} color={theme.accentColor} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {fears && fears.length > 0 ? (
        <FlatList
          data={fears}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContentContainer}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="sad-outline" size={60} color={theme.accentColor} />
          <Text style={[styles.emptyText, { color: theme.textColor }]}>
            No fears added yet.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.accentColor }]}
        onPress={() => setModalVisible(true)}
        testID="add-fear-button"
        accessibilityLabel="Add a new fear"
      >
        <Ionicons name="add" size={30} color={theme.textColor} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>Add New Fear</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.textColor }]}
              placeholder="Fear Name"
              placeholderTextColor={theme.secondaryAccent}
              value={newFearName}
              onChangeText={setNewFearName}
              testID="new-fear-name-input"
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.textColor }]}
              placeholder="Description (optional)"
              placeholderTextColor={theme.secondaryAccent}
              value={newFearDescription}
              onChangeText={setNewFearDescription}
              multiline={true}
              testID="new-fear-description-input"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.secondaryAccent }]}
                onPress={() => setModalVisible(false)}
                testID="cancel-add-fear"
                accessibilityLabel="Cancel adding fear"
              >
                <Text style={[styles.buttonText, { color: theme.textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: theme.accentColor }]}
                onPress={handleAddFear}
                testID="confirm-add-fear"
                accessibilityLabel="Confirm adding fear"
              >
                <Text style={[styles.buttonText, { color: theme.textColor }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  listContentContainer: {
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fearName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  fearTime: {
    fontSize: 12,
    color: '#03DAC5',
  },
  fearDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 5,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#BB86FC',
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#FFFFFF',
  },
  input: {
    width: '100%',
    backgroundColor: '#121212',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  confirmButton: {
    borderRadius: 5,
    padding: 10,
    elevation: 2,
    backgroundColor: '#BB86FC',
    width: '40%',
    alignItems: 'center',
  },
  cancelButton: {
    borderRadius: 5,
    padding: 10,
    elevation: 2,
    backgroundColor: '#03DAC5',
    width: '40%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 10,
  },
});

export default FearListScreen;
