import React, { useContext, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
};

const Dashboard = ({ navigation }) => {
  const { debts, totalOwed, activeDebtsCount, resolveDebt, deleteDebt } = useContext(AppContext);

  const sorted = useMemo(() => {
    return [...(debts || [])].sort((a, b) => {
      const aT = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bT = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bT - aT;
    });
  }, [debts]);

  const handleResolve = (id) => {
    Alert.alert('Mark as paid?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Paid', onPress: () => resolveDebt(id) },
    ]);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete debt?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDebt(id) },
    ]);
  };

  const renderItem = ({ item }) => {
    if (!item) return null;
    const isActive = item.status === 'active';
    return (
      <Pressable
        accessibilityLabel={`debt-${item.id}`}
        testID={`debt-${item.id}`}
        onPress={() => navigation?.navigate?.('DebtDetails', { id: item.id })}
        style={({ pressed }) => [styles.card, isActive ? null : styles.cardResolved, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.amount}>${Number(item.amount || 0).toFixed(2)}</Text>
          <Text style={styles.name}>{item.debtorName || 'Unknown'}</Text>
          {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
          <Text style={styles.date}>{formatDate(item.createdAt)} · {isActive ? 'Active' : 'Resolved'}</Text>
        </View>
        <View style={styles.actions}>
          {isActive ? (
            <Pressable
              accessibilityLabel={`resolve-${item.id}`}
              testID={`resolve-${item.id}`}
              onPress={() => handleResolve(item.id)}
              style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Ionicons name="checkmark-circle" size={26} color="#39FF14" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={`delete-${item.id}`}
            testID={`delete-${item.id}`}
            onPress={(e) => { e?.stopPropagation?.(); handleDelete(item.id); }}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="trash" size={22} color="#ff6b6b" />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>Ledger</Text>
          <Pressable
            accessibilityLabel="add-debt"
            testID="add-debt"
            onPress={() => navigation?.navigate?.('Snap')}
            style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="add" size={22} color="#000000" />
          </Pressable>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Owed</Text>
            <Text style={styles.summaryValue}>${totalOwed.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Active Debts</Text>
            <Text style={styles.summaryValue}>{activeDebtsCount}</Text>
          </View>
        </View>

        <FlatList
          data={sorted}
          keyExtractor={(item) => String(item?.id || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No debts yet. Tap + to add one.</Text>
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  h1: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#39FF14', alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 8 },
  summaryBox: { flex: 1, backgroundColor: '#1A1A1A', padding: 16, borderRadius: 16 },
  summaryLabel: { color: '#888', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  summaryValue: { color: '#39FF14', fontSize: 26, fontWeight: '800', marginTop: 4 },
  card: { flexDirection: 'row', backgroundColor: '#1A1A1A', padding: 16, borderRadius: 16, marginBottom: 12 },
  cardResolved: { opacity: 0.5 },
  cardLeft: { flex: 1 },
  amount: { color: '#39FF14', fontSize: 22, fontWeight: '800' },
  name: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 4 },
  desc: { color: '#bbb', fontSize: 13, marginTop: 4 },
  date: { color: '#666', fontSize: 11, marginTop: 6 },
  actions: { justifyContent: 'space-between', alignItems: 'center', paddingLeft: 8 },
  iconBtn: { padding: 4 },
  empty: { color: '#666', textAlign: 'center', marginTop: 80, fontSize: 14 },
});

export default Dashboard;
