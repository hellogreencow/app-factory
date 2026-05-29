import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@rewind_moments';
const TrackerContext = createContext();

const MOODS = ['great', 'good', 'okay', 'meh'];

function toDateStr(d) { return d.toISOString().slice(0, 10); }

const MOMENT_PROMPTS = [
  'Watched the sky change colors at dusk',
  'The first sip of coffee in a perfectly still kitchen',
  'Golden hour light hitting the brickwork on my walk home',
  'The crackle of a record before the music begins',
  'Had a conversation that made me think differently',
  'Noticed a tiny flower growing through a crack in the sidewalk',
  'A lingering conversation over a half-finished meal',
];

function generateSeed() {
  const entries = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = toDateStr(d);
    entries[key] = {
      date: key,
      note: MOMENT_PROMPTS[i],
      mood: MOODS[Math.floor(Math.random() * MOODS.length)],
      done: true,
    };
  }
  return entries;
}

export function TrackerProvider({ children }) {
  const [entries, setEntries] = useState({});
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!loading) save(); }, [entries, loading]);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      setEntries(raw ? JSON.parse(raw) : generateSeed());
    } catch (_e) { setEntries(generateSeed()); }
    finally { setLoading(false); }
  };
  const save = async () => { try { await AsyncStorage.setItem(KEY, JSON.stringify(entries)); } catch (_e) {} };

  const addEntry = (date, note, mood) => {
    setEntries((prev) => ({ ...prev, [date]: { date, note, mood, done: true } }));
  };

  const getEntry = (date) => entries[date] || null;

  const streak = (() => {
    let s = 0;
    const d = new Date();
    let key = toDateStr(d);
    while (entries[key]?.done) {
      s++;
      d.setDate(d.getDate() - 1);
      key = toDateStr(d);
    }
    return s;
  })();

  const totalEntries = Object.keys(entries).length;

  return (
    <TrackerContext.Provider value={{ entries, selectedDate, setSelectedDate, addEntry, getEntry, streak, totalEntries, loading }}>
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be inside TrackerProvider');
  return ctx;
}
