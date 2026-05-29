import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDistanceToNow, format } from 'date-fns';

const AppContext = createContext();

const initialReceipts = [
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: new Date().toISOString(),
    total: 52.75,
    items: ["Burger", "Fries", "Drink"],
    participants: [],
    imageUri: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    total: 31.20,
    items: ["Coffee", "Sandwich"],
    participants: [],
    imageUri: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: new Date(Date.now() - 604800000).toISOString(), // Last Week
    total: 115.50,
    items: ["Groceries"],
    participants: [],
    imageUri: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: new Date(Date.now() - 2592000000).toISOString(), // Last Month
    total: 89.99,
    items: ["Dinner"],
    participants: [],
    imageUri: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: new Date(Date.now() - 7776000000).toISOString(), // 3 Months Ago
    total: 24.50,
    items: ["Lunch"],
    participants: [],
    imageUri: null,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    date: new Date(Date.now() - 31536000000).toISOString(), // Last Year
    total: 199.00,
    items: ["Electronics"],
    participants: [],
    imageUri: null,
  },
];

const initialParticipants = [
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: "Alice",
    owes: 0,
    paid: 0,
  },
  {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: "Bob",
    owes: 0,
    paid: 0,
  },
];

const AppProvider = ({ children }) => {
  const [receipts, setReceipts] = useState(initialReceipts);
  const [participants, setParticipants] = useState(initialParticipants);

  useEffect(() => {
    const loadData = async () => {
      try {
        const receiptsData = await AsyncStorage.getItem("@splitSnap_receipts");
        const participantsData = await AsyncStorage.getItem("@splitSnap_participants");

        if (receiptsData) {
          setReceipts(JSON.parse(receiptsData));
        } else {
          await AsyncStorage.setItem("@splitSnap_receipts", JSON.stringify(initialReceipts));
        }

        if (participantsData) {
          setParticipants(JSON.parse(participantsData));
        } else {
          await AsyncStorage.setItem("@splitSnap_participants", JSON.stringify(initialParticipants));
        }
      } catch (error) {
        console.error("Error loading data from AsyncStorage:", error);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        await AsyncStorage.setItem("@splitSnap_receipts", JSON.stringify(receipts));
        await AsyncStorage.setItem("@splitSnap_participants", JSON.stringify(participants));
      } catch (error) {
        console.error("Error saving data to AsyncStorage:", error);
      }
    };

    saveData();
  }, [receipts, participants]);

  const addReceipt = useCallback(
    (receipt) => {
      setReceipts((prevReceipts) => [...prevReceipts, { ...receipt, id: Date.now().toString(36) + Math.random().toString(36).slice(2) }]);
    },
    []
  );

  const deleteReceipt = useCallback(
    (id) => {
      setReceipts((prevReceipts) => prevReceipts.filter((receipt) => receipt.id !== id));
    },
    []
  );

  const updateReceipt = useCallback(
    (updatedReceipt) => {
      setReceipts((prevReceipts) =>
        prevReceipts.map((receipt) => (receipt.id === updatedReceipt.id ? updatedReceipt : receipt))
      );
    },
    []
  );

  const addParticipant = useCallback(
    (participant) => {
      setParticipants((prevParticipants) => [
        ...prevParticipants,
        { ...participant, id: Date.now().toString(36) + Math.random().toString(36).slice(2) },
      ]);
    },
    []
  );

  const deleteParticipant = useCallback(
    (id) => {
      setParticipants((prevParticipants) => prevParticipants.filter((participant) => participant.id !== id));
    },
    []
  );

  const updateParticipant = useCallback(
    (updatedParticipant) => {
      setParticipants((prevParticipants) =>
        prevParticipants.map((participant) =>
          participant.id === updatedParticipant.id ? updatedParticipant : participant
        )
      );
    },
    []
  );

  const totalSpending = useMemo(() => {
    return receipts?.reduce((acc, receipt) => acc + receipt.total, 0) || 0;
  }, [receipts]);

  const receiptsByDate = useMemo(() => {
    const grouped = {};
    receipts?.forEach((receipt) => {
      const d = new Date(receipt.date);
      const safeDate = isNaN(d.getTime()) ? new Date() : d;
      const date = format(safeDate, 'yyyy-MM-dd');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(receipt);
    });
    return grouped;
  }, [receipts]);

  const theme = {
    backgroundColor: '#121212',
    textColor: '#FFFFFF',
    accentColor: '#BB86FC',
    cardColor: '#1E1E1E',
  };

  const value = {
    theme,
    receipts,
    participants,
    addReceipt,
    deleteReceipt,
    updateReceipt,
    addParticipant,
    deleteParticipant,
    updateParticipant,
    totalSpending,
    receiptsByDate,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

const useAppData = () => {
  const context = React.useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppData must be used within an AppProvider");
  }
  return context;
};

export { AppProvider, useAppData };
