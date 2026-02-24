import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@dashboard_metrics';
const GOAL_KEY = '@dashboard_goal';
const MetricsContext = createContext();

function generateSeed() {
  const entries = [];
  const now = Date.now();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    entries.push({
      id: d.toISOString().slice(0, 10),
      date: d.toISOString().slice(0, 10),
      value: Math.round(40 + Math.random() * 60),
      label: d.toLocaleDateString('en', { weekday: 'short' }),
      createdAt: d.getTime(),
    });
  }
  return entries;
}

export function MetricsProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [goal, setGoalState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!loading) save(); }, [entries, loading]);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      setEntries(raw ? JSON.parse(raw) : generateSeed());
      const g = await AsyncStorage.getItem(GOAL_KEY);
      if (g) setGoalState(Number(g));
    } catch (_e) { setEntries(generateSeed()); }
    finally { setLoading(false); }
  };
  const save = async () => { try { await AsyncStorage.setItem(KEY, JSON.stringify(entries)); } catch (_e) {} };

  const addEntry = (value, label) => {
    const today = new Date().toISOString().slice(0, 10);
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.date !== today);
      return [...filtered, { id: today, date: today, value: Number(value), label: label || new Date().toLocaleDateString('en', { weekday: 'short' }), createdAt: Date.now() }];
    });
  };

  const updateEntry = (id, value, label) => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, value: Number(value), label: label || e.label, updatedAt: Date.now() } : e));
  };

  const deleteEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const clearAll = async () => {
    setEntries([]);
    try { await AsyncStorage.removeItem(KEY); } catch (_e) {}
  };

  const setGoal = async (v) => {
    const num = v === null ? null : Number(v);
    setGoalState(num);
    try {
      if (num === null) await AsyncStorage.removeItem(GOAL_KEY);
      else await AsyncStorage.setItem(GOAL_KEY, String(num));
    } catch (_e) {}
  };

  const total = entries.reduce((a, e) => a + e.value, 0);
  const avg = entries.length ? Math.round(total / entries.length) : 0;
  const latest = entries[entries.length - 1] || null;

  const best = useMemo(() => {
    if (!entries.length) return null;
    return entries.reduce((a, e) => e.value > a.value ? e : a, entries[0]);
  }, [entries]);

  const streak = useMemo(() => {
    let s = 0;
    for (let i = entries.length - 1; i >= 0; i--) { if (entries[i].value > 0) s++; else break; }
    return s;
  }, [entries]);

  const progress = useMemo(() => {
    if (!goal || !latest) return null;
    return Math.min(100, Math.round((latest.value / goal) * 100));
  }, [goal, latest]);

  const weekEntries = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, day: d.toLocaleDateString('en', { weekday: 'short' }), entry: entries.find(e => e.date === key) || null });
    }
    return result;
  }, [entries]);

  return (
    <MetricsContext.Provider value={{
      entries, loading, addEntry, updateEntry, deleteEntry, clearAll,
      total, avg, latest, best, streak, goal, setGoal, progress, weekEntries,
    }}>
      {children}
    </MetricsContext.Provider>
  );
}

export function useMetrics() {
  const ctx = useContext(MetricsContext);
  if (!ctx) throw new Error('useMetrics must be inside MetricsProvider');
  return ctx;
}
