import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDistanceToNow, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const AppContext = createContext();

const initialDebts = [
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    amount: 50,
    debtorName: "Alice Smith",
    description: "Artisan sourdough & vibes",
    photoUri: null,
    location: { latitude: 37.7749, longitude: -122.4194 },
    createdAt: new Date().toISOString(),
    status: "active",
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    amount: 120,
    debtorName: "Bob Johnson",
    description: "Front row floor seats",
    photoUri: null,
    location: { latitude: 34.0522, longitude: -118.2437 },
    createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    status: "active",
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    amount: 30,
    debtorName: "Charlie Brown",
    description: "Coffee",
    photoUri: null,
    location: { latitude: 40.7128, longitude: -74.0060 },
    createdAt: new Date(Date.now() - 604800000).toISOString(), // Last week
    status: "resolved",
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    amount: 75,
    debtorName: "David Lee",
    description: "Midnight road trip fuel",
    photoUri: null,
    location: { latitude: 51.5074, longitude: 0.1278 },
    createdAt: new Date(Date.now() - 2592000000).toISOString(), // Last month
    status: "active",
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    amount: 25,
    debtorName: "Eve Williams",
    description: "Snacks",
    photoUri: null,
    location: { latitude: -33.8688, longitude: 151.2093 },
    createdAt: new Date(Date.now() - 7776000000).toISOString(), // 3 months ago
    status: "active",
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    amount: 200,
    debtorName: "Frank Miller",
    description: "Vintage synth deposit",
    photoUri: null,
    location: { latitude: 47.6062, longitude: -122.3321 },
    createdAt: new Date(Date.now() - 31536000000).toISOString(), // 1 year ago
    status: "active",
  },
];

export const AppProvider = ({ children }) => {
  const [debts, setDebts] = useState([]);
  const STORAGE_KEY = "@snapdebt_items";

  useEffect(() => {
    const loadDebts = async () => {
      try {
        const storedDebts = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedDebts) {
          setDebts(JSON.parse(storedDebts));
        } else {
          setDebts(initialDebts);
        }
      } catch (error) {
        console.error("Failed to load debts from AsyncStorage", error);
        setDebts(initialDebts);
      }
    };

    loadDebts();
  }, []);

  useEffect(() => {
    const saveDebts = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
      } catch (error) {
        console.error("Failed to save debts to AsyncStorage", error);
      }
    };

    saveDebts();
  }, [debts]);

  const addDebt = useCallback(
    async (amount, debtorName, description, photoUri, location) => {
      const newDebt = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        amount,
        debtorName,
        description,
        photoUri,
        location,
        createdAt: new Date().toISOString(),
        status: "active",
      };

      setDebts((prevDebts) => [...prevDebts, newDebt]);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.vibrateAsync(Haptics.VibrationType.LIGHT);
      }
    },
    []
  );

  const resolveDebt = useCallback(async (id) => {
    setDebts((prevDebts) =>
      prevDebts.map((debt) =>
        debt.id === id ? { ...debt, status: "resolved" } : debt
      )
    );
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.vibrateAsync(Haptics.VibrationType.LIGHT);
    }
  }, []);

  const deleteDebt = useCallback(async (id) => {
    setDebts((prevDebts) => prevDebts.filter((debt) => debt.id !== id));
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.vibrateAsync(Haptics.VibrationType.LIGHT);
    }
  }, []);

  const updatePhoto = useCallback(async (id, photoUri) => {
    setDebts((prevDebts) =>
      prevDebts.map((debt) =>
        debt.id === id ? { ...debt, photoUri } : debt
      )
    );
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.vibrateAsync(Haptics.VibrationType.LIGHT);
    }
  }, []);

  const totalOwed = useMemo(() => {
    return debts?.reduce((sum, debt) => (debt.status === "active" ? sum + debt.amount : sum), 0) || 0;
  }, [debts]);

  const activeDebtsCount = useMemo(() => {
    return debts?.filter((debt) => debt.status === "active").length || 0;
  }, [debts]);

  const debtsByLocation = useMemo(() => {
    const locations = {};
    debts?.forEach((debt) => {
      if (debt?.location?.latitude && debt?.location?.longitude) {
        const key = `${debt.location.latitude},${debt.location.longitude}`;
        if (locations[key]) {
          locations[key].push(debt);
        } else {
          locations[key] = [debt];
        }
      }
    });
    return locations;
  }, [debts]);

  const value = {
    debts,
    addDebt,
    resolveDebt,
    deleteDebt,
    updatePhoto,
    totalOwed,
    activeDebtsCount,
    debtsByLocation,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppData = () => React.useContext(AppContext);
