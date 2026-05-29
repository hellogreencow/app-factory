
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTracker } from '../context/TrackerContext';

const MOODS = ['great', 'good', 'okay', 'meh'];

export default function DayEntryScreen() {
  const route = useRoute();
  const date = route.params?.date || new Date().toISOString().slice(0, 10);
  const { getEntry, addEntry, updateEntry, deleteEntry } = useTracker();
  const existing = getEntry(date);
  const [note, setNote] = useState(existing?.note || '');
  const [mood, setMood] = useState(existing?.mood || 'good');
  const nav = useNavigation();

  const handleSave = () => {
    if (existing) {
      updateEntry(date, note.trim() || 'No note', mood);
    } else {
      addEntry(date, note.trim() || 'No note', mood);
    }
    nav.goBack();
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this entry?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "OK", onPress: () => {
            deleteEntry(date);
            nav.goBack();
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityLabel="Day Entry">{date}</Text>
      <Text style={styles.label}>How did today feel?</Text>
      <View style={styles.moodRow}>
        {MOODS.map((m) => (
          <TouchableOpacity key={m} style={[styles.moodBtn, mood === m && styles.moodActive]} onPress={() => setMood(m)} testID={`mood-${m}`} accessibilityLabel={m}>
            <Text style={[styles.moodText, mood === m && styles.moodTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>What linge#991b1b?</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Describe the light, the sound, or the stillness..." placeholderTextColor="#a0a0b0" multiline testID="input-note" accessibilityLabel="Note" />
      <TouchableOpacity style={styles.btn} onPress={handleSave} testID="save-entry" accessibilityLabel={existing ? "Update Entry" : "Save Entry"}>
        <Text style={styles.btnText}>{existing ? "Update" : "Seal the memory"}</Text>
      </TouchableOpacity>

      {existing && (
        <TouchableOpacity style={[styles.btn, styles.deleteBtn]} onPress={handleDelete} testID="delete-entry" accessibilityLabel="Delete Entry">
          <Text style={styles.btnText}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fffcf5', padding: 24 },
  heading: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 32, letterSpacing: -0.5 },
  label: { color: '#1a1a2e', fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  moodRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  moodBtn: { backgroundColor: '#f8f9fa', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 25, borderWidth: 1, borderColor: '#f0f0f0' },
  moodActive: { backgroundColor: '#d97706', borderColor: '#92400e' },
  moodText: { color: '#1a1a2e', fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  moodTextActive: { color: '#ffffff' },
  input: { backgroundColor: '#f8f9fa', color: '#1a1a2e', borderRadius: 16, padding: 20, fontSize: 16, minHeight: 160, textAlignVertical: 'top', marginBottom: 32, lineHeight: 24 },
  btn: { backgroundColor: '#6366f1', padding: 18, borderRadius: 30, alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  deleteBtn: { backgroundColor: 'red', shadowColor: 'red' },
});
