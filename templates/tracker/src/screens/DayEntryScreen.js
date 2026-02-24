import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTracker } from '../context/TrackerContext';

const MOODS = ['great', 'good', 'okay', 'meh'];

export default function DayEntryScreen() {
  const route = useRoute();
  const date = route.params?.date || new Date().toISOString().slice(0, 10);
  const { getEntry, addEntry } = useTracker();
  const existing = getEntry(date);
  const [note, setNote] = useState(existing?.note || '');
  const [mood, setMood] = useState(existing?.mood || 'good');
  const nav = useNavigation();

  const handleSave = () => {
    addEntry(date, note.trim() || 'No note', mood);
    nav.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityLabel="Day Entry">{date}</Text>
      <Text style={styles.label}>Mood</Text>
      <View style={styles.moodRow}>
        {MOODS.map((m) => (
          <TouchableOpacity key={m} style={[styles.moodBtn, mood === m && styles.moodActive]} onPress={() => setMood(m)} testID={`mood-${m}`} accessibilityLabel={m}>
            <Text style={[styles.moodText, mood === m && styles.moodTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Note</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="How was your day?" placeholderTextColor="#8b949e" multiline testID="input-note" accessibilityLabel="Note" />
      <TouchableOpacity style={styles.btn} onPress={handleSave} testID="save-entry" accessibilityLabel="Save Entry">
        <Text style={styles.btnText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  heading: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  label: { color: '#8b949e', fontSize: 14, marginBottom: 8 },
  moodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  moodBtn: { backgroundColor: '#161b22', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  moodActive: { backgroundColor: '#238636' },
  moodText: { color: '#8b949e', fontSize: 14, fontWeight: '600' },
  moodTextActive: { color: '#fff' },
  input: { backgroundColor: '#161b22', color: '#c9d1d9', borderRadius: 8, padding: 16, fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 24 },
  btn: { backgroundColor: '#238636', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
