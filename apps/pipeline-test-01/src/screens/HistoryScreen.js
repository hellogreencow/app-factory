
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useAppData } from '../context/AppContext';
import { format } from 'date-fns';
import { Feather } from '@expo/vector-icons';

export default function HistoryScreen() {
  const { receipts } = useAppData();
  const [searchText, setSearchText] = useState('');

  const filteredReceipts = receipts.filter((receipt) => {
    const searchTextLower = searchText.toLowerCase();
    return (
      format(new Date(receipt.date), 'MMM dd, yyyy').toLowerCase().includes(searchTextLower) ||
      receipt.items.some(item => item.toLowerCase().includes(searchTextLower))
    );
  });

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.receiptItem}
      testID={`receipt-item-${item.id}`}
      accessibilityLabel={`Receipt for ${format(new Date(item.date), 'MMM dd, yyyy')}`}
    >
      <View style={styles.receiptInfo}>
        <Text style={styles.receiptTotal}>${item.total.toFixed(2)}</Text>
        <Text style={styles.receiptDate}>
          {format(new Date(item.date), 'MMM dd, yyyy')}
        </Text>
      </View>
      <Feather name="chevron-right" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Find a memory..."
        placeholderTextColor="#888"
        value={searchText}
        onChangeText={setSearchText}
        testID="search-input"
        accessibilityLabel="Search receipts"
      />
      {filteredReceipts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No receipts found.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReceipts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.receiptList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 10,
  },
  searchInput: {
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  receiptList: {
    flex: 1,
  },
  receiptItem: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptInfo: {
    flex: 1,
  },
  receiptTotal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiptDate: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});
