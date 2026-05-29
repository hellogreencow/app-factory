import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@generic_items';

const ItemsContext = createContext();

export function ItemsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (!loading) saveItems();
  }, [items, loading]);

  const loadItems = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
      else setItems([{ id: '1', name: 'Sample', value: '1' }]);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const saveItems = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {}
  };

  const addItem = (name, value) => {
    setItems((prev) => [...prev, { id: Date.now().toString(), name: String(name || '').trim(), value: String(value || '') }]);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const getItemById = (id) => items.find((i) => i.id === id);

  return (
    <ItemsContext.Provider value={{ items, loading, addItem, removeItem, getItemById }}>
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error('useItems must be used within ItemsProvider');
  return ctx;
}
