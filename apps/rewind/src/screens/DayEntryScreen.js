
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTracker } from '../context/TrackerContext';

const MOODS = [
  { label: 'great', emoji: '⭐' },
  { label: 'good', emoji: '👍' },
  { label: 'okay', emoji: '😐' },
  { label: 'meh', emoji: '☁️' },
];

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
      <Text style={styles.label}>How did today feel?</Text>
      <View style={styles.moodRow}>
        {MOODS.map(({ label, emoji }) => (
          <TouchableOpacity key={label} style={[styles.moodBtn, mood === label && styles.moodActive]} onPress={() => setMood(label)} testID={`mood-${label}`} accessibilityLabel={label}>
            <Text style={[styles.moodText, mood === label && styles.moodTextActive]}>{emoji} {label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>What stayed with you?</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="The way the light fell, or a word someone said..." placeholderTextColor="#8b949e" multiline testID="input-note" accessibilityLabel="Note" />
      <TouchableOpacity style={styles.btn} onPress={handleSave} testID="save-entry" accessibilityLabel="Save Entry">
        <Text style={styles.btnText}>Keep this</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', padding: 16 },
  heading: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 20 },
  label: { color: '#7d8597', fontSize: 14, marginBottom: 8 },
  moodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  moodBtn: { backgroundColor: '#f8f9fa', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  moodActive: { backgroundColor: '#6366f1' },
  moodText: { color: '#1a1a2e', fontSize: 14, fontWeight: '600' },
  moodTextActive: { color: '#ffffff' },
  input: { backgroundColor: '#f8f9fa', color: '#1a1a2e', borderRadius: 8, padding: 16, fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 24 },
  btn: { backgroundColor: '#6366f1', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
