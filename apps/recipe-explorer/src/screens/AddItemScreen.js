import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useItems } from '../context/ItemsContext';

export default function AddItemScreen() {
  const navigation = useNavigation();
  const { addItem } = useItems();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  const handleSave = () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Error', 'Enter a name');
      return;
    }
    addItem(n, value.trim());
    setName('');
    setValue('');
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title} accessibilityLabel="Add Item">Add Item</Text>
      <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#8b949e" value={name} onChangeText={setName} accessibilityLabel="Name input" testID="input-name" />
      <TextInput style={styles.input} placeholder="Value" placeholderTextColor="#8b949e" value={value} onChangeText={setValue} accessibilityLabel="Value input" testID="input-value" />
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} accessibilityLabel="Save" testID="save-item">
        <Text style={styles.saveBtnText}>Save</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 48, paddingHorizontal: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  input: { backgroundColor: '#161b22', borderWidth: 1, borderColor: '#30363d', borderRadius: 8, padding: 16, fontSize: 16, color: '#fff', marginBottom: 16 },
  saveBtn: { backgroundColor: '#238636', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
