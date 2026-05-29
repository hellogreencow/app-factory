import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContext = createContext();

const initialTimers = [
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Launch the vision", endDate: new Date(new Date().setDate(new Date().getDate() + 7)).getTime(), description: "Final submission for CS 499", repeat: false },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Restock the essentials", endDate: new Date(new Date().setDate(new Date().getDate() + 2)).getTime(), description: "Buy milk, eggs, and bread", repeat: true },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Build the temple", endDate: new Date(new Date().setDate(new Date().getDate() + 1)).getTime(), description: "Leg day", repeat: true },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Meeting with John", endDate: new Date(new Date().setDate(new Date().getDate() + 3)).getTime(), description: "Discuss project progress", repeat: false },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Pay Bills", endDate: new Date(new Date().setDate(new Date().getDate() + 5)).getTime(), description: "Electricity and internet bills", repeat: true },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Book Appointment", endDate: new Date(new Date().setDate(new Date().getDate() + 10)).getTime(), description: "Doctor's appointment", repeat: false },
  { id: Date.now().toString(36) + Math.random().toString(36).slice(2), name: "Weekend Getaway", endDate: new Date(new Date().setDate(new Date().getDate() + 14)).getTime(), description: "Plan a trip to the mountains", repeat: false },
];

const theme = {
  backgroundColor: "#121212",
  cardColor: "#212121",
  textColor: "#FFFFFF",
  accentColor: "#FF453A",
  secondaryAccent: "#E0E0E0",
  borderRadius: 2
};

const AppProvider = ({ children }) => {
  const [timers, setTimers] = useState([]);

  useEffect(() => {
    const loadTimers = async () => {
      try {
        const storedTimers = await AsyncStorage.getItem('@ticktock_timers');
        if (storedTimers) {
          setTimers(JSON.parse(storedTimers));
        } else {
          setTimers(initialTimers);
          await AsyncStorage.setItem('@ticktock_timers', JSON.stringify(initialTimers));
        }
      } catch (error) {
        console.error("Error loading timers from AsyncStorage:", error);
      }
    };

    loadTimers();
  }, []);

  useEffect(() => {
    const saveTimers = async () => {
      try {
        await AsyncStorage.setItem('@ticktock_timers', JSON.stringify(timers));
      } catch (error) {
        console.error("Error saving timers to AsyncStorage:", error);
      }
    };

    saveTimers();
  }, [timers]);

  const addTimer = useCallback(async (newTimer) => {
    const timerWithId = { ...newTimer, id: Date.now().toString(36) + Math.random().toString(36).slice(2) };
    setTimers(prevTimers => [...prevTimers, timerWithId]);
  }, []);

  const deleteTimer = useCallback(async (id) => {
    setTimers(prevTimers => prevTimers.filter(timer => timer.id !== id));
  }, []);

  const updateTimer = useCallback(async (updatedTimer) => {
    setTimers(prevTimers =>
      prevTimers.map(timer => (timer.id === updatedTimer.id ? updatedTimer : timer))
    );
  }, []);

  const activeTimers = useMemo(() => {
    return (timers || []).filter(timer => timer.endDate > Date.now());
  }, [timers]);

  const completedTimers = useMemo(() => {
    return (timers || []).filter(timer => timer.endDate <= Date.now());
  }, [timers]);


  const value = useMemo(() => ({
    timers,
    addTimer,
    deleteTimer,
    updateTimer,
    activeTimers,
    completedTimers,
    theme
  }), [timers, addTimer, deleteTimer, updateTimer, activeTimers, completedTimers, theme]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

const useTimerContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useTimerContext must be used within an AppProvider");
  }
  return context;
};

export { AppProvider, useTimerContext };
