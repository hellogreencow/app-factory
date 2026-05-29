import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Settings">
        Settings
      </Text>
      <Text style={styles.subtitle}>Crypto Portfolio v1.0</Text>
      <Text style={styles.subtitle}>iOS App Factory</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 48, paddingHorizontal: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#8b949e', marginTop: 8 },
});
