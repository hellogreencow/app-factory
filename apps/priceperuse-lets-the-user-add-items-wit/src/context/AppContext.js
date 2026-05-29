import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDistanceToNow, format } from 'date-fns';

const AppContext = createContext();

const defaultTheme = {
  backgroundColor: "#121212",
  cardColor: "#1E1E1E",
  textColor: "#FFFFFF",
  accentColor: "#007AFF",
  secondaryAccent: "#34C759",
  borderRadius: 12
};

const seedItems = [
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Coffee Maker", purchasePrice: 50, uses: 200, datePurchased: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString() },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Running Shoes", purchasePrice: 120, uses: 50, datePurchased: new Date(Date.now() - (60 * 24 * 60 * 60 * 1000)).toISOString() },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Laptop", purchasePrice: 1200, uses: 1000, datePurchased: new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)).toISOString() },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Headphones", purchasePrice: 80, uses: 300, datePurchased: new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)).toISOString() },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Desk Chair", purchasePrice: 200, uses: 750, datePurchased: new Date(Date.now() - (180 * 24 * 60 * 60 * 1000)).toISOString() },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Water Bottle", purchasePrice: 15, uses: 500, datePurchased: new Date(Date.now() - (45 * 24 * 60 * 60 * 1000)).toISOString() },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Keyboard", purchasePrice: 75, uses: 600, datePurchased: new Date(Date.now() - (270 * 24 * 60 * 60 * 1000)).toISOString() }
];

const AppProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [useLogs, setUseLogs] = useState([]);
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedItems = await AsyncStorage.getItem("@price_per_use_items");
        const storedUseLogs = await AsyncStorage.getItem("@price_per_use_use_logs");

        if (storedItems) {
          setItems(JSON.parse(storedItems));
        } else {
          setItems(seedItems);
        }

        if (storedUseLogs) {
          setUseLogs(JSON.parse(storedUseLogs));
        }
      } catch (e) {
        console.error(e);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        await AsyncStorage.setItem("@price_per_use_items", JSON.stringify(items));
        await AsyncStorage.setItem("@price_per_use_use_logs", JSON.stringify(useLogs));
      } catch (e) {
        console.error(e);
      }
    };

    saveData();
  }, [items, useLogs]);

  const addItem = useCallback(async (newItem) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const itemWithId = { ...newItem, id };
    setItems(prevItems => [...prevItems, itemWithId]);
  }, []);

  const deleteItem = useCallback(async (id) => {
    setItems(prevItems => prevItems.filter(item => item.id !== id));
    setUseLogs(prevLogs => prevLogs.filter(log => log.itemId !== id));
  }, []);

  const updateItem = useCallback(async (updatedItem) => {
    setItems(prevItems =>
      prevItems.map(item => (item.id === updatedItem.id ? updatedItem : item))
    );
  }, []);

  const logUse = useCallback(async (itemId) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const newLog = { id, itemId, timestamp: new Date().toISOString() };
    setUseLogs(prevLogs => [...prevLogs, newLog]);

    // Increment the uses count on the item
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id === itemId) {
          return { ...item, uses: item.uses + 1 };
        }
        return item;
      })
    );
  }, []);

  const filteredItems = useMemo(() => {
    return items; // No filtering implemented yet
  }, [items]);

  const itemStats = useMemo(() => {
    const totalSpent = (items || []).reduce((sum, item) => sum + (item?.purchasePrice ?? 0), 0);
    const mostUsedItem = (items || []).reduce((maxItem, item) => {
      return (maxItem?.uses ?? 0) > (item?.uses ?? 0) ? maxItem : item;
    }, null);

    return {
      totalSpent,
      mostUsedItem
    };
  }, [items]);

  const value = useMemo(() => {
    return {
      theme,
      items,
      useLogs,
      addItem,
      deleteItem,
      updateItem,
      logUse,
      filteredItems,
      itemStats
    };
  }, [theme, items, useLogs, addItem, deleteItem, updateItem, logUse, filteredItems, itemStats]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

const useAppData = () => {
  return useContext(AppContext);
};

export { AppProvider, useAppData };
