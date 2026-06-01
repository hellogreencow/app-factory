import React, { useContext } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';

const DebtDetails = ({ route, navigation }) => {
  const { debts, resolveDebt, deleteDebt } = useContext(AppContext);
  const id = route?.params?.id;
  const debt = (debts || []).find((d) => d?.id === id);

  if (!debt) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color="#666" />
          <Text style={styles.notFoundText}>Debt not found.</Text>
          <Pressable
            accessibilityLabel="back-to-ledger"
            testID="back-to-ledger"
            onPress={() => navigation?.goBack?.()}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>Back to Ledger</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = debt.status === 'active';
  const created = debt.createdAt ? new Date(debt.createdAt) : null;
  const validDate = created && !isNaN(created.getTime());

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable
          accessibilityLabel="back-btn"
          testID="back-btn"
          onPress={() => navigation?.goBack?.()}
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="chevron-back" size={20} color="#39FF14" />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>

        <Text style={styles.amount}>${Number(debt.amount || 0).toFixed(2)}</Text>
        <View style={[styles.statusPill, isActive ? styles.statusActive : styles.statusResolved]}>
          <Text style={styles.statusText}>{isActive ? 'Active' : 'Resolved'}</Text>
        </View>

        <View style={styles.card}>
          <Row label="Debtor" value={debt.debtorName || '—'} />
          <Row label="Description" value={debt.description || '—'} />
          <Row label="Date" value={validDate ? created.toLocaleString() : '—'} />
          <Row label="Location" value={debt.location?.latitude != null ? `${debt.location.latitude.toFixed(4)}, ${debt.location.longitude.toFixed(4)}` : '—'} />
        </View>

        <View style={styles.actions}>
          {isActive ? (
            <Pressable
              accessibilityLabel="resolve-btn"
              testID="resolve-btn"
              onPress={() => {
                Alert.alert('Mark as paid?', '', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Mark Paid', onPress: async () => { await resolveDebt(debt.id); navigation?.goBack?.(); } },
                ]);
              }}
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="checkmark-circle" size={20} color="#000" />
              <Text style={styles.primaryText}>Mark as Paid</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="delete-btn"
            testID="delete-btn"
            onPress={() => {
              Alert.alert('Delete debt?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDebt(debt.id); navigation?.goBack?.(); } },
              ]);
            }}
            style={({ pressed }) => [styles.dangerBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="trash" size={20} color="#ff6b6b" />
            <Text style={styles.dangerText}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={3}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: { padding: 20, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backLabel: { color: '#39FF14', fontSize: 16, fontWeight: '600' },
  amount: { color: '#39FF14', fontSize: 48, fontWeight: '800', textAlign: 'center' },
  statusPill: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8, marginBottom: 24 },
  statusActive: { backgroundColor: 'rgba(57,255,20,0.2)' },
  statusResolved: { backgroundColor: 'rgba(120,120,120,0.2)' },
  statusText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  rowLabel: { color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  rowValue: { color: '#FFFFFF', fontSize: 15 },
  actions: { marginTop: 20, gap: 12 },
  primaryBtn: { flexDirection: 'row', backgroundColor: '#39FF14', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#000000', fontSize: 16, fontWeight: '800' },
  dangerBtn: { flexDirection: 'row', backgroundColor: 'rgba(255,107,107,0.15)', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)' },
  dangerText: { color: '#ff6b6b', fontSize: 16, fontWeight: '700' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  notFoundText: { color: '#888', fontSize: 16, marginTop: 12, marginBottom: 24 },
  backBtn: { backgroundColor: '#1A1A1A', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backText: { color: '#39FF14', fontWeight: '700' },
});

export default DebtDetails;
