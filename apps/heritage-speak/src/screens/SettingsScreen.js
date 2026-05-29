import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Settings">Settings</Text>
      <View style={styles.row}><Text style={styles.label}>Font Size</Text><Text style={styles.val}>Medium</Text></View>
      <View style={styles.row}><Text style={styles.label}>Dark Mode</Text><Text style={styles.val}>On</Text></View>
      <View style={styles.row}><Text style={styles.label}>Version</Text><Text style={styles.val}>1.0.0</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#161b22', padding: 16, borderRadius: 8, marginBottom: 8 },
  label: { color: '#c9d1d9', fontSize: 16 },
  val: { color: '#8b949e', fontSize: 16 },
});
