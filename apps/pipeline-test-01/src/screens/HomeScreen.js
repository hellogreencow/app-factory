
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useAppData } from '../context/AppContext';
import { format, formatDistanceToNow } from 'date-fns';
import { Feather } from '@expo/vector-icons';

export default function HomeScreen() {
  const { receipts, totalSpending, receiptsByDate } = useAppData();

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.receiptItem}
      testID={`receipt-item-${item.id}`}
      accessibilityLabel={`Receipt for ${format(new Date(item.date), 'MMM dd, yyyy')}`}
    >
      <View style={styles.receiptInfo}>
        <Text style={styles.receiptTotal}>${item.total.toFixed(2)}</Text>
        <Text style={styles.receiptDate}>
          {formatDistanceToNow(new Date(item.date), {
            addSuffix: true,
          })}
        </Text>
      </View>
      <Feather name="chevron-right" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const sections = Object.entries(receiptsByDate).map(([date, receipts]) => ({
    title: format(new Date(date), 'MMMM dd, yyyy'),
    data: receipts,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.spendingSummary}>
        <Text style={styles.spendingTitle}>Total Spending</Text>
        <Text style={styles.spendingAmount}>${totalSpending.toFixed(2)}</Text>
      </View>

      {receipts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No receipts yet. Add one using the camera!</Text>
        </View>
      ) : (
        <FlatList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
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
  spendingSummary: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  spendingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  spendingAmount: {
    color: '#E0E0E0',
    fontSize: 24,
    fontWeight: 'bold',
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
  sectionHeader: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
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
