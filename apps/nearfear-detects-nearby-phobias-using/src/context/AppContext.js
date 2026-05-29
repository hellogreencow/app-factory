import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContext = createContext();

const initialFears = [
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: "Skittering Shadows",
    description: "The irrational dread of eight-legged architects in dark corners.",
    location: { latitude: 37.7749, longitude: -122.4194 },
    sensorData: { temperature: 25, humidity: 60 },
    severity: 7
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: "Heights",
    description: "Acrophobia - fear of high places.",
    location: { latitude: 34.0522, longitude: -118.2437 },
    sensorData: { altitude: 100 },
    severity: 9
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: "Public Speaking",
    description: "Glossophobia - fear of speaking in public.",
    location: { latitude: 40.7128, longitude: -74.0060 },
    sensorData: { audienceSize: 50 },
    severity: 6
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: "Needles",
    description: "Trypanophobia - fear of injections.",
    location: { latitude: 51.5074, longitude: 0.1278 },
    sensorData: { needleSize: 1 },
    severity: 8
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: "Darkness",
    description: "Nyctophobia - fear of the dark.",
    location: { latitude: -33.8688, longitude: 151.2093 },
    sensorData: { lightLevel: 0 },
    severity: 5
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: "The Painted Grin",
    description: "Uncanny valley personified in greasepaint and oversized shoes.",
    location: { latitude: 48.8566, longitude: 2.3522 },
    sensorData: { clownProximity: 10 },
    severity: 7
  }
];

const STORAGE_KEY = "@nearfear_fears";

const theme = {
  backgroundColor: "#121212",
  cardColor: "#1E1E1E",
  textColor: "#FFFFFF",
  accentColor: "#D1ADFF",
  secondaryAccent: "#70FFEE",
  borderRadius: 8
};

export const AppProvider = ({ children }) => {
  const [fears, setFears] = useState([]);

  useEffect(() => {
    const loadFears = async () => {
      try {
        const storedFears = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedFears) {
          setFears(JSON.parse(storedFears));
        } else {
          setFears(initialFears);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialFears));
        }
      } catch (e) {
        console.error("Error loading fears:", e);
      }
    };

    loadFears();
  }, []);

  useEffect(() => {
    const saveFears = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fears));
      } catch (e) {
        console.error("Error saving fears:", e);
      }
    };

    saveFears();
  }, [fears]);

  const addFear = useCallback(async (newFear) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const fearWithId = { ...newFear, id };
    setFears(prevFears => [...prevFears, fearWithId]);
  }, []);

  const deleteFear = useCallback(async (id) => {
    setFears(prevFears => prevFears.filter(fear => fear.id !== id));
  }, []);

  const updateFear = useCallback(async (updatedFear) => {
    setFears(prevFears =>
      prevFears.map(fear => (fear.id === updatedFear.id ? updatedFear : fear))
    );
  }, []);

  const nearbyFears = useMemo(() => {
    // Implement logic to filter fears based on proximity to the user's location
    // For now, return all fears
    return fears;
  }, [fears]);

  const fearStats = useMemo(() => {
    const totalFears = fears.length;
    const averageSeverity =
      totalFears > 0 ? fears.reduce((sum, fear) => sum + fear.severity, 0) / totalFears : 0;

    return {
      totalFears,
      averageSeverity,
    };
  }, [fears]);

  const value = useMemo(() => {
    return {
      fears,
      addFear,
      deleteFear,
      updateFear,
      nearbyFears,
      fearStats,
      theme
    };
  }, [fears, addFear, deleteFear, updateFear, nearbyFears, fearStats, theme]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useFears = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useFears must be used within an AppProvider");
  }
  return context;
};
