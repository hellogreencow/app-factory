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
      <Text style={styles.title} accessibilityLabel="Stats">Stats</Text>
      <View style={styles.card}><Text style={styles.label}>Current Streak</Text><Text style={styles.big} testID="stat-streak">{streak} days</Text></View>
      <View style={styles.card}><Text style={styles.label}>Total Entries</Text><Text style={styles.big} testID="stat-total">{totalEntries}</Text></View>
      <View style={styles.card}><Text style={styles.label}>Top Mood</Text><Text style={styles.big} testID="stat-mood">{topMood ? topMood[0] : '-'}</Text></View>
      <Text style={styles.section}>Mood Breakdown</Text>
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
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  card: { backgroundColor: '#161b22', borderRadius: 12, padding: 16, marginBottom: 8 },
  label: { color: '#8b949e', fontSize: 13 },
  big: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 4 },
  section: { color: '#8b949e', fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rowLabel: { color: '#c9d1d9', width: 50 },
  barBg: { flex: 1, height: 8, backgroundColor: '#21262d', borderRadius: 4, marginHorizontal: 8 },
  barFill: { height: 8, backgroundColor: '#58a6ff', borderRadius: 4 },
  rowVal: { color: '#8b949e', width: 30, textAlign: 'right' },
});
