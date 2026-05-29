
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { useTracker } from '../context/TrackerContext';

export default function SettingsScreen() {
  const { entries, totalEntries, clearAll, prefs, savePrefs } = useTracker();

  const handleExport = async () => {
    try {
      const sortedEntries = Object.values(entries).sort((a, b) => a.date.localeCompare(b.date));
      const text = sortedEntries
        .map(e => `${e.date}: ${e.mood} - ${e.note}`)
        .join('\n');

      if (text.length === 0) {
        Alert.alert("No entries to export");
        return;
      }

      await Share.share({
        message: text,
        title: 'Amber Gratitude Export',
      });
    } catch (error) {
      Alert.alert("Export failed", error.message);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      "Clear All Data",
      "Are you sure you want to delete all entries? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => clearAll()
        }
      ]
    );
  };

  const toggleReminders = () => {
    savePrefs({ ...prefs, reminders: !prefs.reminders });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Settings" testID="settings-title">Settings</Text>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.row}
          onPress={toggleReminders}
          testID="reminder-toggle"
          accessibilityLabel="Toggle Reminders"
        >
          <Text style={styles.label}>Reminders</Text>
          <Text style={[styles.val, prefs.reminders && styles.activeVal]}>
            {prefs.reminders ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <Text style={styles.label}>Total Entries</Text>
          <Text style={styles.val}>{totalEntries} entries logged</Text>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleExport}
          testID="export-btn"
          accessibilityLabel="Export Data"
        >
          <Text style={styles.buttonText}>Export Data</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={handleClearData}
          testID="clear-btn"
          accessibilityLabel="Clear All Data"
        >
          <Text style={[styles.buttonText, styles.dangerText]}>Clear All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>Amber — For those who notice the small things.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 24, marginTop: 40 },
  section: { marginBottom: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#161b22',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8
  },
  label: { color: '#c9d1d9', fontSize: 16 },
  val: { color: '#8b949e', fontSize: 16 },
  activeVal: { color: '#fbbf24', fontWeight: 'bold' },
  button: {
    backgroundColor: '#161b22',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#30363d'
  },
  buttonText: { color: '#58a6ff', fontSize: 16, fontWeight: '600' },
  dangerButton: { borderColor: '#f85149' },
  dangerText: { color: '#f85149' },
  footer: { marginTop: 'auto', alignItems: 'center', paddingBottom: 20 },
  version: { color: '#484f58', fontSize: 12 }
});
