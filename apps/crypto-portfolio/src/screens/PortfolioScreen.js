import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePortfolio } from '../context/PortfolioContext';
import { getPrice, getTotalValue } from '../data/prices';

export default function PortfolioScreen() {
  const navigation = useNavigation();
  const { assets, removeAsset } = usePortfolio();
  const totalValue = getTotalValue(assets);

  const handleRemove = (item) => {
    Alert.alert('Remove Asset', `Remove ${item.symbol}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeAsset(item.id) },
    ]);
  };

  const renderItem = ({ item }) => {
    const price = getPrice(item.symbol);
    const value = (item.amount || 0) * price;
    return (
      <TouchableOpacity
        style={styles.assetRow}
        onPress={() => navigation.navigate('Chart', { asset: item })}
        accessibilityLabel={`${item.symbol} ${item.amount} worth $${value.toFixed(0)}`}
        testID={`asset-${item.symbol}`}
      >
        <View style={styles.assetInfo}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.amount}>{item.amount} @ ${price.toLocaleString()}</Text>
        </View>
        <Text style={styles.value}>${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
        <TouchableOpacity
          onPress={() => handleRemove(item)}
          style={styles.removeBtn}
          accessibilityLabel={`Remove ${item.symbol}`}
          testID={`remove-${item.symbol}`}
        >
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityLabel="Portfolio">
          Portfolio
        </Text>
        <Text style={styles.total} accessibilityLabel={`Total value $${totalValue.toFixed(0)}`}>
          ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate('AddAsset')}
        accessibilityLabel="Add Asset"
        testID="add-asset"
      >
        <Text style={styles.addBtnText}>+ Add Asset</Text>
      </TouchableOpacity>
      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No assets. Tap Add Asset.</Text>}
        contentContainerStyle={assets.length === 0 && styles.emptyList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 48, paddingHorizontal: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  total: { fontSize: 18, color: '#58a6ff', marginTop: 4 },
  addBtn: {
    backgroundColor: '#238636',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  assetInfo: { flex: 1 },
  symbol: { fontSize: 18, fontWeight: '600', color: '#fff' },
  amount: { fontSize: 14, color: '#8b949e', marginTop: 2 },
  value: { fontSize: 16, fontWeight: '600', color: '#58a6ff', marginRight: 12 },
  removeBtn: { padding: 8 },
  removeText: { fontSize: 24, color: '#f85149', fontWeight: '300' },
  empty: { color: '#8b949e', fontSize: 16, textAlign: 'center' },
  emptyList: { flex: 1, justifyContent: 'center' },
});
