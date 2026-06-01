import React, { useContext } from 'react';
import { View, Text, Switch, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';

const Row = ({ icon, label, value, right, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, { opacity: pressed && onPress ? 0.7 : 1 }]}
  >
    <View style={styles.rowLeft}>
      <Ionicons name={icon} size={20} color="#00d4ff" />
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <View style={styles.rowRight}>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right || null}
    </View>
  </Pressable>
);

const SPEEDS = [
  { label: 'Slow', value: 1.0 },
  { label: 'Normal', value: 0.6 },
  { label: 'Fast', value: 0.3 },
];

export default function Settings() {
  const { preferences, updatePreferences, theme, clearHistory, totalPresses } = useContext(AppContext);

  const haptics = preferences?.hapticsEnabled !== false;
  const sound = preferences?.soundEnabled !== false;
  const speed = typeof preferences?.animationSpeed === 'number' ? preferences.animationSpeed : 0.6;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme?.backgroundColor || '#0a0a0a' }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={[styles.title, { color: theme?.textColor || '#e0e0e0' }]}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Feedback</Text>
        <Row
          icon="pulse"
          label="Haptics"
          right={
            <Switch
              accessibilityLabel="toggle-haptics"
              testID="toggle-haptics"
              value={haptics}
              onValueChange={(v) => updatePreferences({ hapticsEnabled: v })}
            />
          }
        />
        <Row
          icon="volume-high"
          label="Sound"
          right={
            <Switch
              accessibilityLabel="toggle-sound"
              testID="toggle-sound"
              value={sound}
              onValueChange={(v) => updatePreferences({ soundEnabled: v })}
            />
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Animation Speed</Text>
        {SPEEDS.map((s) => (
          <Row
            key={s.value}
            icon="speedometer"
            label={s.label}
            value={`${s.value}s`}
            right={
              speed === s.value ? <Ionicons name="checkmark" size={20} color="#00d4ff" /> : null
            }
            onPress={() => updatePreferences({ animationSpeed: s.value })}
          />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Data</Text>
        <Row icon="trash" label="Clear All History" value={`${totalPresses || 0} presses`} onPress={() => {
          Alert.alert('Clear history?', 'This will remove all recorded presses.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: clearHistory },
          ]);
        }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  section: { marginBottom: 18 },
  sectionLabel: { color: '#666', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1a', padding: 14, borderRadius: 12, marginBottom: 8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { color: '#e0e0e0', fontSize: 15, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { color: '#888', fontSize: 13 },
});
