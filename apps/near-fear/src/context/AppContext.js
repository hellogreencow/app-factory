import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
import { formatDistanceToNow, format } from 'date-fns';

const AppContext = createContext();

const initialDares = [
  {
    id: genId(),
    title: "Eat a Carolina Reaper Pepper",
    description: "Film yourself eating a Carolina Reaper pepper.",
    location: { latitude: 34.0522, longitude: -118.2437 },
    videoUrl: "https://example.com/reaper.mp4",
    creatorId: "user1",
    createdAt: new Date().toISOString(),
    likes: 150,
  },
  {
    id: genId(),
    title: "Sing Karaoke in Public",
    description: "Sing a karaoke song in a public place.",
    location: { latitude: 40.7128, longitude: -74.0060 },
    videoUrl: "https://example.com/karaoke.mp4",
    creatorId: "user2",
    createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    likes: 80,
  },
  {
    id: genId(),
    title: "Ice Bucket Challenge",
    description: "Dump a bucket of ice water on yourself.",
    location: { latitude: 51.5074, longitude: 0.1278 },
    videoUrl: "https://example.com/icebucket.mp4",
    creatorId: "user1",
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    likes: 220,
  },
  {
    id: genId(),
    title: "Public Speaking Challenge",
    description: "Give a speech in a public park.",
    location: { latitude: -33.8688, longitude: 151.2093 },
    videoUrl: "https://example.com/speech.mp4",
    creatorId: "user3",
    createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    likes: 110,
  },
  {
    id: genId(),
    title: "Try a New Food",
    description: "Eat something you've never tried before and record your reaction.",
    location: { latitude: 48.8566, longitude: 2.3522 },
    videoUrl: "https://example.com/newfood.mp4",
    creatorId: "user2",
    createdAt: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
    likes: 180,
  },
  {
    id: genId(),
    title: "Climb a Tree",
    description: "Climb a tree and take a picture from the top.",
    location: { latitude: 37.7749, longitude: -122.4194 },
    videoUrl: "https://example.com/tree.mp4",
    creatorId: "user1",
    createdAt: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
    likes: 95,
  },
  {
    id: genId(),
    title: "Dance in the Rain",
    description: "Record yourself dancing in the rain.",
    location: { latitude: 52.5200, longitude: 13.4050 },
    videoUrl: "https://example.com/rain.mp4",
    creatorId: "user3",
    createdAt: new Date(Date.now() - 518400000).toISOString(), // 6 days ago
    likes: 135,
  },
];

const AppProvider = ({ children }) => {
  const [dares, setDares] = useState(initialDares);
  const [user, setUserState] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedDares = await AsyncStorage.getItem("@nearfear_dares");
        if (storedDares) {
          setDares(JSON.parse(storedDares));
        }

        const storedUser = await AsyncStorage.getItem("@nearfear_user");
        if (storedUser) {
          setUserState(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error("Failed to load data from AsyncStorage", error);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        await AsyncStorage.setItem("@nearfear_dares", JSON.stringify(dares));
      } catch (error) {
        console.error("Failed to save dares to AsyncStorage", error);
      }
    };

    saveData();
  }, [dares]);

  useEffect(() => {
    const saveUser = async () => {
      try {
        await AsyncStorage.setItem("@nearfear_user", JSON.stringify(user));
      } catch (error) {
        console.error("Failed to save user to AsyncStorage", error);
      }
    };

    saveUser();
  }, [user]);

  const addDare = useCallback(
    (newDare) => {
      newDare.id = genId();
      newDare.createdAt = new Date().toISOString();
      setDares((prevDares) => [...prevDares, newDare]);
    },
    [setDares]
  );

  const deleteDare = useCallback(
    (id) => {
      setDares((prevDares) => prevDares.filter((dare) => dare.id !== id));
    },
    [setDares]
  );

  const updateDare = useCallback(
    (updatedDare) => {
      setDares((prevDares) =>
        prevDares.map((dare) => (dare.id === updatedDare.id ? updatedDare : dare))
      );
    },
    [setDares]
  );

  const setUser = useCallback(
    (newUser) => {
      setUserState(newUser);
    },
    [setUserState]
  );

  const getUser = useCallback(() => {
    return user;
  }, [user]);


  const nearbyDares = useMemo(() => {
    // This is a placeholder.  Implement actual proximity check later.
    return dares;
  }, [dares]);

  const userDares = useMemo(() => {
    if (!user) return [];
    return dares.filter((dare) => dare.creatorId === user.id);
  }, [dares, user]);

  const value = {
    dares,
    addDare,
    deleteDare,
    updateDare,
    user,
    setUser,
    getUser,
    nearbyDares,
    userDares,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

const useAppData = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppData must be used within an AppProvider");
  }
  return context;
};

export { AppProvider, useAppData };
