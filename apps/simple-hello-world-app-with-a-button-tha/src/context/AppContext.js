import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startOfDay, differenceInDays } from 'date-fns';

const AppContext = createContext();

const STORAGE_KEYS = {
  PRESSES: '@hello_presses',
  THEMES: '@hello_themes',
  PREFERENCES: '@hello_preferences',
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const INITIAL_THEMES = [
  {
    id: 'theme1',
    name: 'Classic',
    gradient: ['#00d4ff', '#0099cc'],
    messages: ['Hello World!', 'Welcome!', 'Hi There!', 'Greetings!', 'Hey!'],
  },
  {
    id: 'theme2',
    name: 'Purple Dream',
    gradient: ['#9d4edd', '#7209b7'],
    messages: ['Hello Universe!', 'Cosmic Greetings!', 'Star Hello!', 'Galaxy Wave!', 'Space Hi!'],
  },
  {
    id: 'theme3',
    name: 'Sunset',
    gradient: ['#ff6b6b', '#ee5a6f'],
    messages: ['Hello Sunshine!', 'Bright Day!', 'Warm Greetings!', 'Golden Hello!', 'Radiant Hi!'],
  },
  {
    id: 'theme4',
    name: 'Ocean',
    gradient: ['#06b6d4', '#0891b2'],
    messages: ['Hello Ocean!', 'Wave Hello!', 'Deep Blue Hi!', 'Sea Greetings!', 'Aqua Wave!'],
  },
  {
    id: 'theme5',
    name: 'Forest',
    gradient: ['#10b981', '#059669'],
    messages: ['Hello Nature!', 'Green Greetings!', 'Forest Hi!', 'Earth Wave!', 'Leaf Hello!'],
  },
  {
    id: 'theme6',
    name: 'Fire',
    gradient: ['#f59e0b', '#d97706'],
    messages: ['Hello Fire!', 'Blazing Hi!', 'Hot Greetings!', 'Flame Wave!', 'Ember Hello!'],
  },
];

const INITIAL_PRESSES = [
  {
    id: generateId(),
    timestamp: Date.now() - 86400000 * 2,
    message: 'Hello World!',
    themeId: 'theme1',
  },
  {
    id: generateId(),
    timestamp: Date.now() - 86400000 * 1,
    message: 'Welcome!',
    themeId: 'theme1',
  },
  {
    id: generateId(),
    timestamp: Date.now() - 3600000 * 12,
    message: 'Hello Universe!',
    themeId: 'theme2',
  },
  {
    id: generateId(),
    timestamp: Date.now() - 3600000 * 6,
    message: 'Cosmic Greetings!',
    themeId: 'theme2',
  },
  {
    id: generateId(),
    timestamp: Date.now() - 3600000 * 3,
    message: 'Hello Sunshine!',
    themeId: 'theme3',
  },
  {
    id: generateId(),
    timestamp: Date.now() - 3600000 * 1,
    message: 'Bright Day!',
    themeId: 'theme3',
  },
  {
    id: generateId(),
    timestamp: Date.now() - 1800000,
    message: 'Hello Ocean!',
    themeId: 'theme4',
  },
];

const INITIAL_PREFERENCES = {
  selectedThemeId: 'theme1',
  hapticsEnabled: true,
  animationSpeed: 1.0,
  soundEnabled: false,
};

export const AppProvider = ({ children }) => {
  const [presses, setPresses] = useState(INITIAL_PRESSES);
  const [themes, setThemes] = useState(INITIAL_THEMES);
  const [preferences, setPreferences] = useState(INITIAL_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pressesData, themesData, preferencesData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PRESSES),
        AsyncStorage.getItem(STORAGE_KEYS.THEMES),
        AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES),
      ]);

      if (pressesData) {
        const parsed = JSON.parse(pressesData);
        setPresses(Array.isArray(parsed) ? parsed : INITIAL_PRESSES);
      }

      if (themesData) {
        const parsed = JSON.parse(themesData);
        setThemes(Array.isArray(parsed) ? parsed : INITIAL_THEMES);
      }

      if (preferencesData) {
        const parsed = JSON.parse(preferencesData);
        setPreferences(parsed && typeof parsed === 'object' ? parsed : INITIAL_PREFERENCES);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      savePresses();
    }
  }, [presses, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveThemes();
    }
  }, [themes, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      savePreferences();
    }
  }, [preferences, isLoading]);

  const savePresses = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PRESSES, JSON.stringify(presses));
    } catch (error) {
      console.error('Error saving presses:', error);
    }
  };

  const saveThemes = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEMES, JSON.stringify(themes));
    } catch (error) {
      console.error('Error saving themes:', error);
    }
  };

  const savePreferences = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const addPress = useCallback((message, themeId) => {
    const newPress = {
      id: generateId(),
      timestamp: Date.now(),
      message: message || 'Hello World!',
      themeId: themeId || preferences.selectedThemeId,
    };
    setPresses((prev) => [newPress, ...(prev || [])]);
  }, [preferences.selectedThemeId]);

  const deletePress = useCallback((pressId) => {
    setPresses((prev) => (prev || []).filter((press) => press?.id !== pressId));
  }, []);

  const clearHistory = useCallback(() => {
    setPresses([]);
  }, []);

  const setTheme = useCallback((themeId) => {
    setPreferences((prev) => ({
      ...(prev || INITIAL_PREFERENCES),
      selectedThemeId: themeId,
    }));
  }, []);

  const updatePreferences = useCallback((updates) => {
    setPreferences((prev) => ({
      ...(prev || INITIAL_PREFERENCES),
      ...updates,
    }));
  }, []);

  const totalPresses = useMemo(() => {
    return (presses || []).length;
  }, [presses]);

  const pressesPerTheme = useMemo(() => {
    const counts = {};
    (themes || []).forEach((theme) => {
      if (theme?.id) {
        counts[theme.id] = 0;
      }
    });
    (presses || []).forEach((press) => {
      if (press?.themeId && counts[press.themeId] !== undefined) {
        counts[press.themeId]++;
      }
    });
    return counts;
  }, [presses, themes]);

  const currentStreak = useMemo(() => {
    if (!presses || presses.length === 0) return 0;

    const sortedPresses = [...presses].sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
    const today = startOfDay(new Date());
    let streak = 0;
    let currentDay = today;

    for (const press of sortedPresses) {
      if (!press?.timestamp) continue;
      const pressDate = new Date(press.timestamp);
      if (isNaN(pressDate.getTime())) continue;
      const pressDay = startOfDay(pressDate);
      const dayDiff = differenceInDays(currentDay, pressDay);

      if (dayDiff === 0) {
        if (streak === 0) streak = 1;
        continue;
      } else if (dayDiff === 1) {
        streak++;
        currentDay = pressDay;
      } else {
        break;
      }
    }

    return streak;
  }, [presses]);

  const longestStreak = useMemo(() => {
    if (!presses || presses.length === 0) return 0;

    const sortedPresses = [...presses].sort((a, b) => (a?.timestamp || 0) - (b?.timestamp || 0));
    const uniqueDays = new Set();

    (sortedPresses || []).forEach((press) => {
      if (press?.timestamp) {
        const pressDate = new Date(press.timestamp);
        if (!isNaN(pressDate.getTime())) {
          const dayKey = startOfDay(pressDate).getTime();
          uniqueDays.add(dayKey);
        }
      }
    });

    const sortedDays = Array.from(uniqueDays).sort((a, b) => a - b);
    let maxStreak = 0;
    let currentStreakCount = 1;

    for (let i = 1; i < sortedDays.length; i++) {
      const prevDay = new Date(sortedDays[i - 1]);
      const currDay = new Date(sortedDays[i]);
      const diff = differenceInDays(currDay, prevDay);

      if (diff === 1) {
        currentStreakCount++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreakCount);
        currentStreakCount = 1;
      }
    }

    maxStreak = Math.max(maxStreak, currentStreakCount);
    return maxStreak;
  }, [presses]);

  const selectedTheme = useMemo(() => {
    return (themes || []).find((t) => t?.id === preferences?.selectedThemeId) || themes?.[0] || INITIAL_THEMES[0];
  }, [themes, preferences]);

  const theme = useMemo(() => ({
    backgroundColor: '#0a0a0a',
    textColor: '#e0e0e0',
    accentColor: '#00d4ff',
    cardColor: '#1a1a1a',
    secondaryAccent: '#9d4edd',
    borderRadius: 16,
  }), []);

  const contextValue = useMemo(() => ({
    presses,
    themes,
    preferences,
    selectedTheme,
    theme,
    isLoading,
    addPress,
    deletePress,
    clearHistory,
    setTheme,
    updatePreferences,
    totalPresses,
    pressesPerTheme,
    currentStreak,
    longestStreak,
  }), [
    presses,
    themes,
    preferences,
    selectedTheme,
    theme,
    isLoading,
    addPress,
    deletePress,
    clearHistory,
    setTheme,
    updatePreferences,
    totalPresses,
    pressesPerTheme,
    currentStreak,
    longestStreak,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
