import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePortfolio } from '../context/PortfolioContext';

export default function AddAssetScreen() {
  const navigation = useNavigation();
  const { addAsset } = usePortfolio();
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');

  const handleSave = () => {
    const s = symbol.trim().toUpperCase();
    const a = parseFloat(amount);
    if (!s) {
      Alert.alert('Error', 'Enter a symbol (e.g. BTC, ETH)');
      return;
    }
    if (isNaN(a) || a <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    addAsset(s, a, s);
    setSymbol('');
    setAmount('');
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title} accessibilityLabel="Add Asset">
        Add Asset
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Symbol (e.g. BTC, ETH)"
        placeholderTextColor="#8b949e"
        value={symbol}
        onChangeText={setSymbol}
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel="Symbol input"
        testID="input-symbol"
      />
      <TextInput
        style={styles.input}
        placeholder="Amount"
        placeholderTextColor="#8b949e"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        accessibilityLabel="Amount input"
        testID="input-amount"
      />
      <TouchableOpacity
        style={styles.saveBtn}
        onPress={handleSave}
        accessibilityLabel="Save"
        testID="save-asset"
      >
        <Text style={styles.saveBtnText}>Save</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 48, paddingHorizontal: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  input: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#238636',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
