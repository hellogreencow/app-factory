import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@amber_moments';
const PREFS_KEY = '@amber_prefs';
const TrackerContext = createContext();

function toDateStr(d) { return d.toISOString().slice(0, 10); }

function generateSeed() {
  const entries = {};
  const now = new Date();
  const memories = [
    "The low hum of a record player before the first track starts.",
    "The way the kitchen light pools on the floor at 6 PM.",
    "Finding a forgotten polaroid in the back of a drawer.",
    "The precise moment the espresso hit the hot milk.",
    "A long walk where the shadows stretched thin and elegant.",
    "The tactile scratch of a fountain pen on heavy paper.",
    "Cold air, warm breath, and the first star appearing."
  ];
  const moods = ['great', 'good', 'okay', 'meh'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = toDateStr(d);
    entries[key] = { 
      date: key, 
      note: memories[i], 
      mood: moods[i % 2 === 0 ? 0 : 1], 
      done: true, 
      createdAt: d.getTime() 
    };
  }
  return entries;
}

export function TrackerProvider({ children }) {
  const [entries, setEntries] = useState({});
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState({ reminders: false });

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!loading) save(); }, [entries, loading]);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      setEntries(raw ? JSON.parse(raw) : generateSeed());
      const p = await AsyncStorage.getItem(PREFS_KEY);
      if (p) setPrefs(JSON.parse(p));
    } catch (_e) { setEntries(generateSeed()); }
    finally { setLoading(false); }
  };
  const save = async () => { try { await AsyncStorage.setItem(KEY, JSON.stringify(entries)); } catch (_e) {} };

  const savePrefs = async (p) => {
    setPrefs(p);
    try { await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (_e) {}
  };

  const addEntry = (date, note, mood) => {
    setEntries((prev) => ({ ...prev, [date]: { date, note, mood, done: true, createdAt: Date.now() } }));
  };

  const updateEntry = (date, note, mood) => {
    setEntries((prev) => {
      if (!prev[date]) return prev;
      return { ...prev, [date]: { ...prev[date], note, mood, updatedAt: Date.now() } };
    });
  };

  const deleteEntry = (date) => {
    setEntries((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  };

  const clearAll = async () => {
    setEntries({});
    try { await AsyncStorage.removeItem(KEY); } catch (_e) {}
  };

  const getEntry = (date) => entries[date] || null;

  const streak = useMemo(() => {
    let s = 0;
    const d = new Date();
    let key = toDateStr(d);
    while (entries[key]?.done) {
      s++;
      d.setDate(d.getDate() - 1);
      key = toDateStr(d);
    }
    return s;
  }, [entries]);

  const longestStreak = useMemo(() => {
    const dates = Object.keys(entries).sort();
    let max = 0, cur = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0) { cur = 1; }
      else {
        const prev = new Date(dates[i - 1]);
        const next = new Date(dates[i]);
        const diff = (next - prev) / 86400000;
        cur = diff === 1 ? cur + 1 : 1;
      }
      if (cur > max) max = cur;
    }
    return max;
  }, [entries]);

  const totalEntries = Object.keys(entries).length;

  const moodCounts = useMemo(() => {
    const counts = { great: 0, good: 0, okay: 0, meh: 0 };
    Object.values(entries).forEach((e) => {
      if (counts[e.mood] !== undefined) counts[e.mood]++;
    });
    return counts;
  }, [entries]);

  const weekEntries = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = toDateStr(d);
      result.push({ date: key, day: d.toLocaleDateString('en', { weekday: 'short' }), entry: entries[key] || null });
    }
    return result;
  }, [entries]);

  return (
    <TrackerContext.Provider value={{
      entries, selectedDate, setSelectedDate, loading,
      addEntry, updateEntry, deleteEntry, getEntry, clearAll,
      streak, longestStreak, totalEntries, moodCounts, weekEntries,
      prefs, savePrefs,
    }}>
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be inside TrackerProvider');
  return ctx;
}