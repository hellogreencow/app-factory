import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@generic_items';
const SORT_KEY = '@generic_sort';

const ItemsContext = createContext();

export function ItemsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortModeState] = useState('newest');

  useEffect(() => { loadItems(); }, []);
  useEffect(() => { if (!loading) saveItems(); }, [items, loading]);

  const loadItems = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
      else setItems([{ id: '1', name: 'Sample', value: '1', createdAt: Date.now() }]);
      const s = await AsyncStorage.getItem(SORT_KEY);
      if (s) setSortModeState(s);
    } catch (_e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const saveItems = async () => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (_e) {}
  };

  const addItem = (name, value) => {
    setItems((prev) => [...prev, { id: Date.now().toString(), name: String(name || '').trim(), value: String(value || ''), createdAt: Date.now() }]);
  };

  const updateItem = (id, name, value) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, name: String(name || '').trim(), value: String(value || ''), updatedAt: Date.now() } : i));
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearAll = async () => {
    setItems([]);
    try { await AsyncStorage.removeItem(STORAGE_KEY); } catch (_e) {}
  };

  const setSortMode = async (mode) => {
    setSortModeState(mode);
    try { await AsyncStorage.setItem(SORT_KEY, mode); } catch (_e) {}
  };

  const getItemById = (id) => items.find((i) => i.id === id);

  const sorted = useMemo(() => {
    const copy = [...items];
    switch (sortMode) {
      case 'oldest': return copy.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      case 'az': return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'za': return copy.sort((a, b) => b.name.localeCompare(a.name));
      default: return copy.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  }, [items, sortMode]);

  return (
    <ItemsContext.Provider value={{
      items, sorted, loading, addItem, updateItem, removeItem, clearAll,
      getItemById, sortMode, setSortMode,
    }}>
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error('useItems must be used within ItemsProvider');
  return ctx;
}
