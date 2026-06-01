import React, { useContext, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';

const CreateDebt = ({ navigation }) => {
  const { addDebt } = useContext(AppContext);
  const [amount, setAmount] = useState('');
  const [debtorName, setDebtorName] = useState('');
  const [description, setDescription] = useState('');

  const validAmount = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
  const validName = debtorName.trim().length > 0;
  const canSubmit = validAmount && validName;

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Missing info', 'Please enter a name and a positive amount.');
      return;
    }
    try {
      await addDebt(parseFloat(amount), debtorName.trim(), description.trim(), null, null);
      navigation?.navigate?.('Ledger');
    } catch (e) {
      Alert.alert('Error', 'Could not save debt. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.h1}>Snap a Debt</Text>
            <Text style={styles.subtitle}>Log who owes you what</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Amount ($)</Text>
            <TextInput
              accessibilityLabel="amount-input"
              testID="amount-input"
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Who owes you</Text>
            <TextInput
              accessibilityLabel="name-input"
              testID="name-input"
              style={styles.input}
              value={debtorName}
              onChangeText={setDebtorName}
              placeholder="Their name"
              placeholderTextColor="#666"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              accessibilityLabel="description-input"
              testID="description-input"
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What was it for?"
              placeholderTextColor="#666"
              multiline
            />
          </View>

          <Pressable
            accessibilityLabel="save-debt"
            testID="save-debt"
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.saveBtn,
              { opacity: !canSubmit ? 0.4 : pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="checkmark" size={20} color="#000" />
            <Text style={styles.saveText}>Save Debt</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: { padding: 20, paddingTop: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  h1: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#888', fontSize: 14, marginTop: 4 },
  field: { marginBottom: 16 },
  label: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: '#1A1A1A', color: '#FFFFFF', padding: 14, borderRadius: 12, fontSize: 16 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { flexDirection: 'row', backgroundColor: '#39FF14', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveText: { color: '#000000', fontSize: 16, fontWeight: '800' },
});

export default CreateDebt;
