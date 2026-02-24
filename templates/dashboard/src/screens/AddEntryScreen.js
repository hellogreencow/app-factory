import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMetrics } from '../context/MetricsContext';

export default function AddEntryScreen() {
  const [value, setValue] = useState('');
  const { addEntry } = useMetrics();
  const nav = useNavigation();

  const handleSave = () => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    addEntry(num);
    nav.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityLabel="Add Entry">Add Entry</Text>
      <Text style={styles.label}>Value</Text>
      <TextInput style={styles.input} value={value} onChangeText={setValue} keyboardType="numeric" placeholder="0" placeholderTextColor="#8b949e" testID="input-value" accessibilityLabel="Entry value" />
      <TouchableOpacity style={[styles.btn, !value && styles.btnOff]} onPress={handleSave} disabled={!value} testID="save-entry" accessibilityLabel="Save Entry">
        <Text style={styles.btnText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  heading: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  label: { color: '#8b949e', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#161b22', color: '#fff', borderRadius: 8, padding: 16, fontSize: 20, marginBottom: 24 },
  btn: { backgroundColor: '#238636', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnOff: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
