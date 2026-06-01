
import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { AppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const ReceiptDetailsScreen = ({ route, navigation }) => {
  const { receiptId } = route.params || {};
  const { receipts, updateReceipt, deleteReceipt, theme } = useContext(AppContext);
  
  const receipt = receipts.find(r => r.id === receiptId);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedStore, setEditedStore] = useState(receipt?.storeName || '');
  const [editedTotal, setEditedTotal] = useState(receipt?.totalAmount?.toString() || '0');

  if (!receipt) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textColor }}>Receipt not found</Text>
        <TouchableOpacity 
          style={{ marginTop: 20 }} 
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: theme.accentColor }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSave = () => {
    const newTotal = parseFloat(editedTotal);
    if (isNaN(newTotal)) {
      Alert.alert('Error', 'Invalid total amount.');
      return;
    }

    updateReceipt(receipt.id, {
      storeName: editedStore,
      totalAmount: newTotal,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Receipt",
      "Are you sure you want to delete this receipt?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            deleteReceipt(receipt.id);
            navigation.navigate('History');
          } 
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} testID="back-button">
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textColor }]}>Receipt Details</Text>
        <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
          <Ionicons name={isEditing ? "close" : "create-outline"} size={24} color={theme.accentColor} />
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardColor }]}>
        {isEditing ? (
          <View>
            <Text style={[styles.label, { color: theme.textColor }]}>Store Name</Text>
            <TextInput
              style={[styles.input, { color: theme.textColor, borderColor: theme.accentColor }]}
              value={editedStore}
              onChangeText={setEditedStore}
            />
            <Text style={[styles.label, { color: theme.textColor }]}>Total Amount</Text>
            <TextInput
              style={[styles.input, { color: theme.textColor, borderColor: theme.accentColor }]}
              value={editedTotal}
              onChangeText={setEditedTotal}
              keyboardType="numeric"
            />
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.accentColor }]} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={[styles.storeName, { color: theme.textColor }]}>{receipt.storeName}</Text>
            <Text style={[styles.date, { color: 'gray' }]}>{new Date(receipt.date).toLocaleDateString()}</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.totalLabel, { color: theme.textColor }]}>Total</Text>
              <Text style={[styles.totalAmount, { color: theme.accentColor }]}>${receipt.totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardColor }]}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Participants</Text>
        {(receipt.participants || []).map((participant, index) => (
          <View key={index} style={styles.participantRow}>
            <Text style={[styles.participantName, { color: theme.textColor }]}>{participant.name}</Text>
            <Text style={[styles.participantOwes, { color: theme.accentColor }]}>
              ${participant.owes.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={[styles.deleteButton, { borderColor: '#ff3b30' }]} 
        onPress={handleDelete}
        testID="delete-receipt-button"
      >
        <Text style={styles.deleteButtonText}>Delete Receipt</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storeName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  participantName: {
    fontSize: 16,
  },
  participantOwes: {
    fontSize: 16,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  saveButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  deleteButton: {
    borderWidth: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  deleteButtonText: {
    color: '#ff3b30',
    fontWeight: 'bold',
  },
});

export default ReceiptDetailsScreen;
