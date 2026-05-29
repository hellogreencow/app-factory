import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@dashboard_metrics';
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
    });
  }
  return entries;
}

export function MetricsProvider({ children }) {
  const [entries, setEntries] = useState([]);
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
  const save = async () => { try { await AsyncStorage.setItem(KEY, JSON.stringify(entries)); } catch (_e) { /* persist best-effort */ } };

  const addEntry = (value) => {
    const today = new Date().toISOString().slice(0, 10);
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.date !== today);
      return [...filtered, { id: today, date: today, value: Number(value), label: new Date().toLocaleDateString('en', { weekday: 'short' }) }];
    });
  };

  const total = entries.reduce((a, e) => a + e.value, 0);
  const avg = entries.length ? Math.round(total / entries.length) : 0;
  const latest = entries[entries.length - 1];
  const streak = (() => {
    let s = 0;
    for (let i = entries.length - 1; i >= 0; i--) { if (entries[i].value > 0) s++; else break; }
    return s;
  })();

  return (
    <MetricsContext.Provider value={{ entries, loading, addEntry, total, avg, latest, streak }}>
      {children}
    </MetricsContext.Provider>
  );
}

export function useMetrics() {
  const ctx = useContext(MetricsContext);
  if (!ctx) throw new Error('useMetrics must be inside MetricsProvider');
  return ctx;
}
