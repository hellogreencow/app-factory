import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useItems } from '../context/ItemsContext';

export default function ListScreen() {
  const navigation = useNavigation();
  const { items, removeItem } = useItems();

  const handleRemove = (item) => {
    Alert.alert('Remove', `Remove ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItem(item.id) },
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('Detail', { item })}
      accessibilityLabel={`${item.name} ${item.value}`}
      testID={`item-${item.id}`}
    >
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.value}>{item.value}</Text>
      </View>
      <TouchableOpacity onPress={() => handleRemove(item)} style={styles.removeBtn} accessibilityLabel={`Remove ${item.name}`} testID={`remove-${item.id}`}>
        <Text style={styles.removeText}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityLabel="Items">Items</Text>
        <Text style={styles.count} accessibilityLabel={`${items.length} items`}>{items.length} items</Text>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddItem')} accessibilityLabel="Add Item" testID="add-item">
        <Text style={styles.addBtnText}>Add Item</Text>
      </TouchableOpacity>
      <FlatList data={items} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No items yet</Text>} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  count: { fontSize: 14, color: '#8b949e', marginTop: 4 },
  addBtn: { backgroundColor: '#238636', marginHorizontal: 16, padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#161b22', padding: 16, borderRadius: 8, marginBottom: 8 },
  info: { flex: 1 },
  name: { fontSize: 18, fontWeight: '600', color: '#fff' },
  value: { fontSize: 14, color: '#8b949e', marginTop: 4 },
  removeBtn: { padding: 8 },
  removeText: { color: '#f85149', fontSize: 24 },
  empty: { color: '#8b949e', textAlign: 'center', marginTop: 24 },
});
