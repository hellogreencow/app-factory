import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';

const Stat = ({ label, value, icon, color }) => (
  <View style={[styles.statCard, { backgroundColor: '#1a1a1a' }]}>
    <Ionicons name={icon} size={28} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default function Stats() {
  const { totalPresses, currentStreak, longestStreak, pressesPerTheme, themes, theme } = useContext(AppContext);

  const themeList = (themes || []).filter((t) => t && t.id);
  const maxCount = Math.max(1, ...Object.values(pressesPerTheme || {}).map((v) => Number(v) || 0));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme?.backgroundColor || '#0a0a0a' }]}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
    >
      <Text style={[styles.title, { color: theme?.textColor || '#e0e0e0' }]}>Stats</Text>

      <View style={styles.row}>
        <Stat label="Total Presses" value={totalPresses} icon="finger-print" color="#00d4ff" />
        <Stat label="Current Streak" value={`${currentStreak}d`} icon="flame" color="#ff6b6b" />
      </View>
      <View style={styles.row}>
        <Stat label="Longest Streak" value={`${longestStreak}d`} icon="trophy" color="#f59e0b" />
        <Stat label="Themes Used" value={Object.values(pressesPerTheme || {}).filter((v) => Number(v) > 0).length} icon="color-palette" color="#9d4edd" />
      </View>

      <Text style={[styles.sectionTitle, { color: theme?.textColor || '#e0e0e0' }]}>By Theme</Text>
      <View style={{ marginTop: 8 }}>
        {themeList.length === 0 ? (
          <Text style={styles.empty}>No themes yet.</Text>
        ) : (
          themeList.map((t) => {
            const count = Number(pressesPerTheme?.[t.id] || 0);
            const pct = Math.round((count / maxCount) * 100);
            const gradient = Array.isArray(t.gradient) && t.gradient.length >= 2 ? t.gradient[0] : '#00d4ff';
            return (
              <View key={t.id} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: theme?.textColor || '#e0e0e0' }]} numberOfLines={1}>
                  {t.name}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: gradient }]} />
                </View>
                <Text style={styles.barCount}>{count}</Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
  statValue: { color: '#ffffff', fontSize: 26, fontWeight: '800', marginTop: 8 },
  statLabel: { color: '#888', fontSize: 12, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  barLabel: { width: 90, fontSize: 13, fontWeight: '600' },
  barTrack: { flex: 1, height: 10, backgroundColor: '#1a1a1a', borderRadius: 5, marginHorizontal: 10, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  barCount: { color: '#888', fontSize: 12, width: 30, textAlign: 'right' },
  empty: { color: '#666', textAlign: 'center', marginTop: 24 },
});
