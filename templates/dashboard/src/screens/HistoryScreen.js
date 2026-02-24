import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useMetrics } from '../context/MetricsContext';

export default function HistoryScreen() {
  const { entries } = useMetrics();
  const sorted = [...entries].reverse();

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="History" testID="history-title">History</Text>
      <FlatList
        data={sorted}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row} testID={`entry-${item.id}`}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.val}>{item.value}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No entries yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#161b22', padding: 16, borderRadius: 8, marginBottom: 8 },
  date: { color: '#c9d1d9', fontSize: 16 },
  val: { color: '#58a6ff', fontSize: 18, fontWeight: '700' },
  empty: { color: '#8b949e', textAlign: 'center', marginTop: 24 },
});
