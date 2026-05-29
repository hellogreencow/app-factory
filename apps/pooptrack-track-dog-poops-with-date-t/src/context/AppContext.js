import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDistanceToNow, format } from 'date-fns';

const AppContext = createContext();

const defaultTheme = {
  backgroundColor: "#121212",
  cardColor: "#212121",
  textColor: "#FFFFFF",
  accentColor: "#03DAC5",
  secondaryAccent: "#BB86FC",
  borderRadius: 8
};

const initialPoops = [
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: Date.now() - (1000 * 60 * 60 * 24 * 2), // 2 days ago
    time: "07:30 AM",
    location: { latitude: 37.78825, longitude: -122.4324 },
    consistency: "Firm",
    color: "Brown",
    notes: "Normal poop after morning walk.",
    photo: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: Date.now() - (1000 * 60 * 60 * 24 * 1), // 1 day ago
    time: "06:00 PM",
    location: { latitude: 37.7749, longitude: -122.4194 },
    consistency: "Soft",
    color: "Dark Brown",
    notes: "Slightly softer than usual.",
    photo: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: Date.now(),
    time: "08:00 AM",
    location: { latitude: 37.795, longitude: -122.4024 },
    consistency: "Firm",
    color: "Brown",
    notes: "Perfect poop!",
    photo: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: Date.now() - (1000 * 60 * 60 * 24 * 3), // 3 days ago
    time: "10:00 AM",
    location: { latitude: 37.76, longitude: -122.45 },
    consistency: "Loose",
    color: "Yellowish Brown",
    notes: "Possible dietary issue. Monitor closely.",
    photo: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: Date.now() - (1000 * 60 * 60 * 24 * 4), // 4 days ago
    time: "05:00 PM",
    location: { latitude: 37.80, longitude: -122.42 },
    consistency: "Firm",
    color: "Brown",
    notes: "Normal.",
    photo: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: Date.now() - (1000 * 60 * 60 * 24 * 5), // 5 days ago
    time: "09:00 AM",
    location: { latitude: 37.75, longitude: -122.40 },
    consistency: "Soft",
    color: "Brown",
    notes: "Slightly soft.",
    photo: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: Date.now() - (1000 * 60 * 60 * 24 * 6), // 6 days ago
    time: "07:00 PM",
    location: { latitude: 37.79, longitude: -122.44 },
    consistency: "Firm",
    color: "Dark Brown",
    notes: "Good.",
    photo: null,
  },
];

const AppProvider = ({ children }) => {
  const [poops, setPoops] = useState(initialPoops);
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const loadPoops = async () => {
      try {
        const storedPoops = await AsyncStorage.getItem('@pooptrack_poops');
        if (storedPoops) {
          setPoops(JSON.parse(storedPoops));
        }
      } catch (err) { console.error(err); }
    };
    loadPoops();
  }, []);

  useEffect(() => {
    const savePoops = async () => {
      try {
        await AsyncStorage.setItem('@pooptrack_poops', JSON.stringify(poops));
      } catch (err) { console.error(err); }
    };
    savePoops();
  }, [poops]);

  const addPoop = useCallback(async (newPoop) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const poopWithId = { ...newPoop, id };
    setPoops((prevPoops) => [...prevPoops, poopWithId]);
  }, []);

  const deletePoop = useCallback(async (id) => {
    setPoops((prevPoops) => prevPoops.filter((poop) => poop.id !== id));
  }, []);

  const updatePoop = useCallback(async (updatedPoop) => {
    setPoops((prevPoops) =>
      prevPoops.map((poop) => (poop.id === updatedPoop.id ? updatedPoop : poop))
    );
  }, []);

  const filteredPoops = useMemo(() => {
    return [...poops].sort((a, b) => b.date - a.date);
  }, [poops]);

  const poopStats = useMemo(() => {
    const totalPoops = poops.length;
    const firmPoops = poops.filter((poop) => poop.consistency === "Firm").length;
    const softPoops = poops.filter((poop) => poop.consistency === "Soft").length;
    const loosePoops = poops.filter((poop) => poop.consistency === "Loose").length;

    return {
      totalPoops,
      firmPercentage: totalPoops > 0 ? (firmPoops / totalPoops) * 100 : 0,
      softPercentage: totalPoops > 0 ? (softPoops / totalPoops) * 100 : 0,
      loosePercentage: totalPoops > 0 ? (loosePoops / totalPoops) * 100 : 0,
    };
  }, [poops]);

  const value = useMemo(
    () => ({
      poops,
      addPoop,
      deletePoop,
      updatePoop,
      filteredPoops,
      poopStats,
      theme,
      setTheme
    }),
    [poops, addPoop, deletePoop, updatePoop, filteredPoops, poopStats, theme]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

const usePoopData = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("usePoopData must be used within an AppProvider");
  }
  return context;
};

export { AppProvider, usePoopData };
