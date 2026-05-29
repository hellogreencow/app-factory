
import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { AppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const SplitScreen = ({ navigation }) => {
  const { receipts, updateReceipt, theme } = useContext(AppContext);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [newParticipantName, setNewParticipantName] = useState('');

  const selectedReceipt = receipts.find(r => r.id === selectedReceiptId);

  const handleSelectReceipt = (id) => {
    setSelectedReceiptId(id);
    const receipt = receipts.find(r => r.id === id);
    if (receipt) {
      setParticipants(receipt.participants || []);
    }
  };

  const addParticipant = () => {
    if (newParticipantName.trim() === '') return;
    const newParticipant = {
      id: Date.now().toString(),
      name: newParticipantName,
      owes: 0,
    };
    setParticipants([...participants, newParticipant]);
    setNewParticipantName('');
  };

  const removeParticipant = (id) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const calculateSplit = () => {
    if (!selectedReceipt) {
      Alert.alert("No Receipt Selected", "Please select a receipt to calculate the split.");
      return;
    }

    if (participants.length === 0) {
      Alert.alert("No Participants", "Please add at least one participant.");
      return;
    }

    const splitAmount = selectedReceipt.totalAmount / participants.length;
    const updatedParticipants = participants.map(p => ({
      ...p,
      owes: splitAmount,
    }));

    setParticipants(updatedParticipants);
    updateReceipt(selectedReceiptId, { participants: updatedParticipants });
    
    Alert.alert("Split Calculated", `Each person owes $${splitAmount.toFixed(2)}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <Text style={[styles.title, { color: theme.textColor }]}>Split Bill</Text>
      
      <Text style={[styles.label, { color: theme.textColor }]}>1. Select a Receipt</Text>
      <View style={{ height: 120 }}>
        <FlatList
          horizontal
          data={receipts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.receiptCard,
                { backgroundColor: theme.cardColor },
                selectedReceiptId === item.id && { borderColor: theme.accentColor, borderWidth: 2 }
              ]}
              onPress={() => handleSelectReceipt(item.id)}
            >
              <Text style={[styles.receiptStore, { color: theme.textColor }]} numberOfLines={1}>{item.storeName}</Text>
              <Text style={[styles.receiptAmount, { color: theme.accentColor }]}>${item.totalAmount.toFixed(2)}</Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      <Text style={[styles.label, { color: theme.textColor, marginTop: 20 }]}>2. Add Participants</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { color: theme.textColor, borderColor: theme.cardColor, backgroundColor: theme.cardColor }]}
          placeholder="Participant Name"
          placeholderTextColor="gray"
          value={newParticipantName}
          onChangeText={setNewParticipantName}
        />
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.accentColor }]} onPress={addParticipant}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={participants}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.participantItem, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.participantName, { color: theme.textColor }]}>{item.name}</Text>
            <View style={styles.participantRight}>
              <Text style={[styles.participantOwes, { color: theme.accentColor }]}>${item.owes.toFixed(2)}</Text>
              <TouchableOpacity onPress={() => removeParticipant(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#ff3b30" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        style={styles.participantList}
      />

      <TouchableOpacity 
        style={[styles.calculateButton, { backgroundColor: theme.accentColor }]} 
        onPress={calculateSplit}
      >
        <Text style={styles.calculateButtonText}>Calculate Split</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  receiptCard: {
    width: 140,
    height: 80,
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  receiptStore: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantList: {
    flex: 1,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
  },
  participantRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantOwes: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 15,
  },
  calculateButton: {
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  calculateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SplitScreen;
