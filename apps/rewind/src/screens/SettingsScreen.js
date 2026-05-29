import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Settings">Settings</Text>
      <View style={styles.row}><Text style={styles.label}>Reminders</Text><Text style={styles.val}>9:00 AM</Text></View>
      <View style={styles.row}><Text style={styles.label}>Dark Mode</Text><Text style={styles.val}>On</Text></View>
      <View style={styles.row}><Text style={styles.label}>Version</Text><Text style={styles.val}>1.0.0</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdfcfb', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8, marginBottom: 8 },
  label: { color: '#1a1a2e', fontSize: 16 },
  val: { color: '#8b949e', fontSize: 16 },
});
