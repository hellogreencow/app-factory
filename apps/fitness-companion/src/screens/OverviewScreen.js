import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMetrics } from '../context/MetricsContext';

function MetricCard({ label, value, unit, testID }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue} testID={testID}>{value}{unit ? ` ${unit}` : ''}</Text>
    </View>
  );
}

function MiniChart({ entries }) {
  const max = Math.max(...entries.map((e) => e.value), 1);
  const last7 = entries.slice(-7);
  return (
    <View style={styles.chart} testID="mini-chart">
      {last7.map((e) => (
        <View key={e.id} style={styles.barCol}>
          <View style={[styles.bar, { height: Math.max(4, (e.value / max) * 80) }]} />
          <Text style={styles.barLabel}>{e.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function OverviewScreen() {
  const { entries, total, avg, streak } = useMetrics();
  const nav = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Overview">Overview</Text>
      <View style={styles.grid}>
        <MetricCard label="Total" value={total} testID="metric-total" />
        <MetricCard label="Average" value={avg} testID="metric-avg" />
        <MetricCard label="Streak" value={`${streak}d`} testID="metric-streak" />
        <MetricCard label="Entries" value={entries.length} testID="metric-count" />
      </View>
      <Text style={styles.sectionTitle}>Last 7 Days</Text>
      <MiniChart entries={entries} />
      <TouchableOpacity style={styles.addBtn} onPress={() => nav.navigate('AddEntry')} testID="add-entry" accessibilityLabel="Add Entry">
        <Text style={styles.addBtnText}>+ Log Today</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  card: { backgroundColor: '#161b22', borderRadius: 12, padding: 16, width: '48%' },
  cardLabel: { color: '#8b949e', fontSize: 13, marginBottom: 4 },
  cardValue: { color: '#fff', fontSize: 24, fontWeight: '700' },
  sectionTitle: { color: '#8b949e', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, backgroundColor: '#161b22', borderRadius: 12, padding: 12, marginBottom: 24 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 20, backgroundColor: '#58a6ff', borderRadius: 4 },
  barLabel: { color: '#8b949e', fontSize: 10, marginTop: 4 },
  addBtn: { backgroundColor: '#238636', padding: 16, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
