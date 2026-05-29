
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTracker } from '../context/TrackerContext';

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

const MOOD_COLORS = {
  great: '#2d6a4f', // green
  good: '#70a1ff',  // blue
  okay: '#f59e0b',  // amber
  meh: '#484f58',   // gray
};

export default function CalendarScreen() {
  const { entries, selectedDate, setSelectedDate, streak, totalEntries } = useTracker();
  const nav = useNavigation();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = getDaysInMonth(year, month);
  const monthName = now.toLocaleDateString('en', { month: 'long', year: 'numeric' });

  const grid = [];
  for (let d = 1; d <= days; d++) {
    const dt = new Date(year, month, d);
    const key = dt.toISOString().slice(0, 10);
    const hasEntry = !!entries[key];
    const isSelected = key === selectedDate;
    const isToday = key === now.toISOString().slice(0, 10);
    grid.push({ day: d, key, hasEntry, isSelected, isToday });
  }

  // Calculate last 7 days summary
  const last7Days = [];
  let loggedCount = 0;
  const moodFrequency = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = entries[key];
    if (entry) {
      loggedCount++;
      moodFrequency[entry.mood] = (moodFrequency[entry.mood] || 0) + 1;
    }
    last7Days.push({
      key,
      mood: entry?.mood,
      letter: entry?.mood ? entry.mood.charAt(0).toUpperCase() : ''
    });
  }

  const mostFrequentMood = Object.entries(moodFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
  const summaryText = `${loggedCount} of 7 days logged — ${mostFrequentMood !== 'none' ? `mostly ${mostFrequentMood}` : 'no entries yet'}`;

  if (totalEntries === 0) {
    return (
      <View style={styles.emptyContainer} testID="empty-calendar">
        <Text style={styles.emptyTitle}>The first glimmer awaits</Text>
        <Text style={styles.emptySubtitle}>Capture three golden moments in a warm evening ritual.</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => nav.navigate('DayEntry', { date: now.toISOString().slice(0, 10) })} testID="add-entry" accessibilityLabel="Add Entry">
          <Text style={styles.addBtnText}>Log Today</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Calendar">{monthName}</Text>
      
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statNum} testID="streak">{streak}d</Text><Text style={styles.statLabel}>Streak</Text></View>
        <View style={styles.stat}><Text style={styles.statNum} testID="total-entries">{totalEntries}</Text><Text style={styles.statLabel}>Entries</Text></View>
      </View>

      <View style={styles.summaryContainer} testID="weekly-summary">
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.weekRow}>
          {last7Days.map((day, index) => (
            <View 
              key={day.key} 
              style={[
                styles.moodCircle, 
                { backgroundColor: day.mood ? MOOD_COLORS[day.mood] : '#161b22' }
              ]}
            >
              <Text style={styles.moodLetter}>{day.letter}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.summaryText}>{summaryText}</Text>
      </View>

      <View style={styles.grid}>
        {grid.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.dayCell, g.hasEntry && styles.dayCellDone, g.isSelected && styles.dayCellSelected]}
            onPress={() => { setSelectedDate(g.key); nav.navigate('DayEntry', { date: g.key }); }}
            testID={`day-${g.day}`}
            accessibilityLabel={`Day ${g.day}`}
          >
            <Text style={[styles.dayText, g.isToday && styles.dayToday]}>{g.day}</Text>
            {g.hasEntry && <View style={styles.dot} />}
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity style={styles.addBtn} onPress={() => nav.navigate('DayEntry', { date: now.toISOString().slice(0, 10) })} testID="add-entry" accessibilityLabel="Add Entry">
        <Text style={styles.addBtnText}>Capture tonight's glow</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  stat: { alignItems: 'center' },
  statNum: { color: '#58a6ff', fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  
  summaryContainer: { backgroundColor: '#161b22', padding: 16, borderRadius: 12, marginBottom: 24 },
  sectionTitle: { color: '#8b949e', fontSize: 14, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  moodCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  moodLetter: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  summaryText: { color: '#8b949e', fontSize: 13 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 24 },
  dayCell: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#161b22', alignItems: 'center', justifyContent: 'center' },
  dayCellDone: { backgroundColor: '#0e4429' },
  dayCellSelected: { borderWidth: 2, borderColor: '#58a6ff' },
  dayText: { color: '#c9d1d9', fontSize: 14 },
  dayToday: { color: '#58a6ff', fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#3fb950', position: 'absolute', bottom: 4 },
  addBtn: { backgroundColor: '#238636', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 40 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  emptyContainer: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center', padding: 16 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 16, color: '#8b949e', textAlign: 'center', marginBottom: 24 },
});
