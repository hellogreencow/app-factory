import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTracker } from '../context/TrackerContext';

export default function StatsScreen() {
  const { entries, streak, totalEntries } = useTracker();
  const vals = Object.values(entries);
  const moods = { great: 0, good: 0, okay: 0, meh: 0 };
  vals.forEach((e) => { if (moods[e.mood] !== undefined) moods[e.mood]++; });
  const topMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0];

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Stats">The Rhythm of Your Days</Text>
      <View style={styles.card}><Text style={styles.label}>Days of awareness</Text><Text style={styles.big} testID="stat-streak">{streak} days</Text></View>
      <View style={styles.card}><Text style={styles.label}>Total Moments</Text><Text style={styles.big} testID="stat-total">{totalEntries}</Text></View>
      <View style={styles.card}><Text style={styles.label}>Your baseline</Text><Text style={styles.big} testID="stat-mood">{topMood ? topMood[0] : '-'}</Text></View>
      <Text style={styles.section}>Mood Overview</Text>
      {Object.entries(moods).map(([m, c]) => (
        <View key={m} style={styles.row}>
          <Text style={styles.rowLabel}>{m}</Text>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${totalEntries ? (c / totalEntries) * 100 : 0}%` }]} /></View>
          <Text style={styles.rowVal}>{c}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  card: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 8 },
  label: { color: '#a27b5c', fontSize: 13 },
  big: { color: '#1a1a2e', fontSize: 28, fontWeight: '700', marginTop: 4 },
  section: { color: '#6366f1', fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rowLabel: { color: '#1a1a2e', width: 50 },
  barBg: { flex: 1, height: 8, backgroundColor: '#f8f9fa', borderRadius: 4, marginHorizontal: 8 },
  barFill: { height: 8, backgroundColor: '#6366f1', borderRadius: 4 },
  rowVal: { color: '#1a1a2e', width: 30, textAlign: 'right' },
});