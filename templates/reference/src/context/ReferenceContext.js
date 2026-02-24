import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@reference_items';
const READ_KEY = '@reference_read';
const ReferenceContext = createContext();

const SEED = [
  { id: '1', title: 'Getting Started', body: 'Welcome to the reference guide. Tap any item to read more.', category: 'Basics', bookmarked: false, bookmarkedAt: null },
  { id: '2', title: 'Navigation', body: 'Use the bottom tabs to switch between Browse, Bookmarks, and Settings.', category: 'Basics', bookmarked: false, bookmarkedAt: null },
  { id: '3', title: 'Advanced Queries', body: 'Combine filters and search terms for precise results.', category: 'Advanced', bookmarked: true, bookmarkedAt: Date.now() - 86400000 },
  { id: '4', title: 'Keyboard Shortcuts', body: 'Common shortcuts to speed up your workflow.', category: 'Tips', bookmarked: false, bookmarkedAt: null },
  { id: '5', title: 'Data Export', body: 'Export your data in JSON or CSV format.', category: 'Advanced', bookmarked: true, bookmarkedAt: Date.now() - 43200000 },
  { id: '6', title: 'Theming', body: 'Customize colors and fonts to your liking.', category: 'Tips', bookmarked: false, bookmarkedAt: null },
];

export function ReferenceProvider({ children }) {
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!loading) save(); }, [items, loading]);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      setItems(raw ? JSON.parse(raw) : SEED);
      const r = await AsyncStorage.getItem(READ_KEY);
      if (r) setReadIds(new Set(JSON.parse(r)));
    } catch (_e) { setItems(SEED); }
    finally { setLoading(false); }
  };
  const save = async () => { try { await AsyncStorage.setItem(KEY, JSON.stringify(items)); } catch (_e) {} };

  const markRead = async (id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(READ_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

  const toggleBookmark = (id) => {
    setItems((prev) => prev.map((x) => x.id === id
      ? { ...x, bookmarked: !x.bookmarked, bookmarkedAt: x.bookmarked ? null : Date.now() }
      : x));
  };

  const clearBookmarks = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, bookmarked: false, bookmarkedAt: null })));
  };

  const categories = useMemo(() => ['All', ...new Set(items.map((i) => i.category))], [items]);

  const filtered = useMemo(() => {
    let res = items;
    if (activeCategory !== 'All') res = res.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return res;
  }, [items, search, activeCategory]);

  const bookmarked = useMemo(() =>
    items.filter((i) => i.bookmarked).sort((a, b) => (b.bookmarkedAt || 0) - (a.bookmarkedAt || 0)),
  [items]);

  const getItem = (id) => items.find((i) => i.id === id);

  const getRelated = (id, limit = 3) => {
    const item = getItem(id);
    if (!item) return [];
    return items.filter((i) => i.id !== id && i.category === item.category).slice(0, limit);
  };

  const readCount = readIds.size;

  return (
    <ReferenceContext.Provider value={{
      items, filtered, bookmarked, categories, activeCategory, setActiveCategory,
      search, setSearch, toggleBookmark, clearBookmarks, getItem, getRelated,
      markRead, readCount, loading,
    }}>
      {children}
    </ReferenceContext.Provider>
  );
}

export function useReference() {
  const ctx = useContext(ReferenceContext);
  if (!ctx) throw new Error('useReference must be inside ReferenceProvider');
  return ctx;
}
