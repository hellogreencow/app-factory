
import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Button,
  SafeAreaView,
} from 'react-native';
import { useAppData } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function ChallengesScreen() {
  const { challenges, places, addChallenge, theme } = useAppData();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newChallengeName, setNewChallengeName] = useState('');
  const [newChallengeDescription, setNewChallengeDescription] = useState('');
  const [newChallengePlaceId, setNewChallengePlaceId] = useState(places[0]?.id || '');

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
    setNewChallengeName('');
    setNewChallengeDescription('');
    setNewChallengePlaceId(places[0]?.id || '');
  };

  const handleAddChallenge = () => {
    const newChallenge = {
      name: newChallengeName,
      description: newChallengeDescription,
      placeId: newChallengePlaceId,
      participants: [],
    };
    addChallenge(newChallenge);
    toggleModal();
  };

  const renderItem = ({ item }) => {
    const place = places.find((p) => p.id === item.placeId);
    return (
      <TouchableOpacity
        style={[styles.challengeItem, { backgroundColor: theme.cardColor }]}
        testID={`challenge-item-${item.id}`}
        accessibilityLabel={`Challenge ${item.name}`}
      >
        <Text style={[styles.challengeName, { color: theme.textColor }]}>{item.name}</Text>
        <Text style={[styles.challengeDescription, { color: theme.textColor }]}>{item.description}</Text>
        <Text style={[styles.challengePlace, { color: theme.textColor }]}>
          Place: {place ? place.name : 'Unknown'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <FlatList
        data={challenges}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={() => (
          <Text style={[styles.emptyListText, { color: theme.textColor }]}>No challenges yet. Create one!</Text>
        )}
        testID="challenges-list"
        accessibilityLabel="List of challenges"
      />

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.accentColor }]}
        onPress={toggleModal}
        testID="add-challenge-button"
        accessibilityLabel="Add challenge"
      >
        <Ionicons name="add" size={30} color={theme.textColor} />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        testID="add-challenge-modal"
        accessibilityLabel="Add challenge modal"
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>Create New Challenge</Text>

            <Text style={[styles.label, { color: theme.textColor }]}>Name:</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.textColor }]}
              value={newChallengeName}
              onChangeText={setNewChallengeName}
              placeholder="Challenge Name"
              placeholderTextColor={theme.textColor}
              testID="challenge-name-input"
              accessibilityLabel="Challenge Name"
            />

            <Text style={[styles.label, { color: theme.textColor }]}>Description:</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.textColor }]}
              value={newChallengeDescription}
              onChangeText={setNewChallengeDescription}
              placeholder="Challenge Description"
              placeholderTextColor={theme.textColor}
              testID="challenge-description-input"
              accessibilityLabel="Challenge Description"
            />

            <Text style={[styles.label, { color: theme.textColor }]}>Place:</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundColor, color: theme.textColor }]}
              value={newChallengePlaceId}
              onChangeText={setNewChallengePlaceId}
              placeholder="Place ID"
              placeholderTextColor={theme.textColor}
              testID="challenge-place-id-input"
              accessibilityLabel="Challenge Place ID"
            />

            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={toggleModal} color={theme.secondaryAccent} testID="cancel-button" accessibilityLabel="Cancel" />
              <Button title="Manifest Fear" onPress={handleAddChallenge} color={theme.accentColor} testID="add-button" accessibilityLabel="Add Challenge" />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  challengeItem: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  challengeName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  challengeDescription: {
    fontSize: 14,
  },
  challengePlace: {
    fontSize: 12,
    marginTop: 5,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  emptyListText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});
