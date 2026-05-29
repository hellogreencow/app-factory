import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, formatDistanceToNow } from 'date-fns';

const AppContext = createContext();

const initialTheme = {
  backgroundColor: "#121212",
  cardColor: "#212121",
  textColor: "#FFFFFF",
  accentColor: "#E0E0E0",
  secondaryAccent: "#3700B3",
  borderRadius: 8
};

const initialColorHistory = [
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), date: '2024-01-20', hex: '#E91E63', name: 'Velvet Raspberry' },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), date: '2024-01-19', hex: '#9C27B0', name: 'Deep Ultra-Violet' },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), date: '2024-01-18', hex: '#3F51B5', name: 'Midnight Ink' },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), date: '2024-01-17', hex: '#03A9F4', name: 'Electric Sky' },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), date: '2024-01-16', hex: '#009688', name: 'Veridian Mist' },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), date: '2024-01-15', hex: '#4CAF50', name: 'Alpine Spruce' },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), date: '2024-01-14', hex: '#FFEB3B', name: 'Solar Flare' },
];

const AppProvider = ({ children }) => {
  const [colorHistory, setColorHistory] = useState(initialColorHistory);
  const [todaysColor, setTodaysColor] = useState(null);

  const theme = useMemo(() => initialTheme, []);

  const COLOR_HISTORY_STORAGE_KEY = "@dailycolor_history";

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const storedHistory = await AsyncStorage.getItem(COLOR_HISTORY_STORAGE_KEY);
        if (storedHistory) {
          setColorHistory(JSON.parse(storedHistory));
        } else {
          await AsyncStorage.setItem(COLOR_HISTORY_STORAGE_KEY, JSON.stringify(initialColorHistory));
          setColorHistory(initialColorHistory);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    const saveHistory = async () => {
      try {
        await AsyncStorage.setItem(COLOR_HISTORY_STORAGE_KEY, JSON.stringify(colorHistory));
      } catch (err) {
        console.error(err);
      }
    };

    saveHistory();
  }, [colorHistory]);

  const generateColor = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const seed = today.split('-').reduce((acc, val) => acc + parseInt(val), 0);
    const random = Math.sin(seed) * 10000;
    const hexCode = '#' + Math.floor(Math.abs(random * 16777215) % 16777215).toString(16).padStart(6, '0');

    // Simple color name generation (replace with a better library if needed)
    const colorName = `Color ${seed}`;

    setTodaysColor({ date: today, hex: hexCode, name: colorName });
    return { date: today, hex: hexCode, name: colorName };
  }, []);

  const addToHistory = useCallback(async (color) => {
    const newColor = { ...color, id: Date.now().toString(36) + Math.random().toString(36).slice(2) };
    setColorHistory(prevHistory => [newColor, ...prevHistory]);
  }, []);

  const deleteFromHistory = useCallback(async (id) => {
    setColorHistory(prevHistory => (prevHistory || []).filter(item => item.id !== id));
  }, []);

  const contextValue = useMemo(() => ({
    colorHistory,
    todaysColor,
    generateColor,
    addToHistory,
    deleteFromHistory,
    theme,
  }), [colorHistory, todaysColor, generateColor, addToHistory, deleteFromHistory, theme]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

const useColorContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useColorContext must be used within a AppProvider");
  }
  return context;
};

export { AppProvider, useColorContext };
