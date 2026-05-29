import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@reference_items';
const ReferenceContext = createContext();

const SEED = [
  { id: '1', title: 'Getting Started', body: 'Welcome to the reference guide. Tap any item to read more.', category: 'Basics', bookmarked: false },
  { id: '2', title: 'Navigation', body: 'Use the bottom tabs to switch between Browse, Bookmarks, and Settings.', category: 'Basics', bookmarked: false },
  { id: '3', title: 'Advanced Queries', body: 'Combine filters and search terms for precise results.', category: 'Advanced', bookmarked: true },
  { id: '4', title: 'Keyboard Shortcuts', body: 'Common shortcuts to speed up your workflow.', category: 'Tips', bookmarked: false },
  { id: '5', title: 'Data Export', body: 'Export your data in JSON or CSV format.', category: 'Advanced', bookmarked: true },
  { id: '6', title: 'Theming', body: 'Customize colors and fonts to your liking.', category: 'Tips', bookmarked: false },
];

export function ReferenceProvider({ children }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!loading) save(); }, [items, loading]);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      setItems(raw ? JSON.parse(raw) : SEED);
    } catch (_e) { setItems(SEED); }
    finally { setLoading(false); }
  };
  const save = async () => { try { await AsyncStorage.setItem(KEY, JSON.stringify(items)); } catch (_e) { /* persist best-effort */ } };

  const toggleBookmark = (id) => {
    setItems((prev) => prev.map((x) => x.id === id ? { ...x, bookmarked: !x.bookmarked } : x));
  };

  const categories = useMemo(() => ['All', ...new Set(items.map((i) => i.category))], [items]);

  const filtered = useMemo(() => {
    let res = items;
    if (activeCategory !== 'All') res = res.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q));
    }
    return res;
  }, [items, search, activeCategory]);

  const bookmarked = useMemo(() => items.filter((i) => i.bookmarked), [items]);

  const getItem = (id) => items.find((i) => i.id === id);

  return (
    <ReferenceContext.Provider value={{ items, filtered, bookmarked, categories, activeCategory, setActiveCategory, search, setSearch, toggleBookmark, getItem, loading }}>
      {children}
    </ReferenceContext.Provider>
  );
}

export function useReference() {
  const ctx = useContext(ReferenceContext);
  if (!ctx) throw new Error('useReference must be inside ReferenceProvider');
  return ctx;
}
