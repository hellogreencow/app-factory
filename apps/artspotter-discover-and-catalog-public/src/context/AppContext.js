import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContext = createContext();

const STORAGE_KEYS = {
  INSTALLATIONS: '@artspotter_installations',
  PROFILE: '@artspotter_profile',
  VISITS: '@artspotter_visits',
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const SEED_INSTALLATIONS = [
  {
    id: generateId(),
    title: "Urban Mosaic",
    artist: "Elena Rodriguez",
    description: "A vibrant mosaic wall depicting the city's multicultural heritage through colorful ceramic tiles and glass fragments.",
    imageUri: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800",
    latitude: 40.7580,
    longitude: -73.9855,
    category: "Mural",
    dateAdded: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    userId: "seed_user",
    likes: 127,
    visits: 43,
  },
  {
    id: generateId(),
    title: "Reflections in Steel",
    artist: "Marcus Chen",
    description: "An abstract sculpture made from polished stainless steel that reflects the surrounding architecture and sky in mesmerizing patterns.",
    imageUri: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=800",
    latitude: 40.7614,
    longitude: -73.9776,
    category: "Sculpture",
    dateAdded: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    userId: "seed_user",
    likes: 89,
    visits: 31,
  },
  {
    id: generateId(),
    title: "Garden of Light",
    artist: "Yuki Tanaka",
    description: "Interactive LED installation that responds to movement, creating waves of color through a field of illuminated flowers.",
    imageUri: "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=800",
    latitude: 40.7489,
    longitude: -73.9680,
    category: "Installation",
    dateAdded: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    userId: "seed_user",
    likes: 203,
    visits: 67,
  },
  {
    id: generateId(),
    title: "Wings of Freedom",
    artist: "Amara Johnson",
    description: "Large-scale mural featuring powerful imagery of birds in flight, symbolizing hope and liberation in the community.",
    imageUri: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800",
    latitude: 40.7549,
    longitude: -73.9840,
    category: "Mural",
    dateAdded: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    userId: "seed_user",
    likes: 156,
    visits: 52,
  },
  {
    id: generateId(),
    title: "The Conversation",
    artist: "David Kim",
    description: "Bronze sculpture of two figures engaged in dialogue, representing the importance of human connection in urban spaces.",
    imageUri: "https://images.unsplash.com/photo-1578926078223-f4c8c2eb7d3e?w=800",
    latitude: 40.7505,
    longitude: -73.9934,
    category: "Sculpture",
    dateAdded: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    userId: "seed_user",
    likes: 94,
    visits: 28,
  },
  {
    id: generateId(),
    title: "Digital Dreams",
    artist: "Sofia Patel",
    description: "Projection mapping installation that transforms building facades into dynamic canvases of light and motion every evening.",
    imageUri: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=800",
    latitude: 40.7589,
    longitude: -73.9851,
    category: "Installation",
    dateAdded: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    userId: "seed_user",
    likes: 178,
    visits: 45,
  },
  {
    id: generateId(),
    title: "Harmony in Chaos",
    artist: "James O'Brien",
    description: "Mixed media piece combining recycled materials into a thought-provoking commentary on consumption and sustainability.",
    imageUri: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=800",
    latitude: 40.7628,
    longitude: -73.9765,
    category: "Mixed Media",
    dateAdded: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    userId: "seed_user",
    likes: 112,
    visits: 36,
  },
  {
    id: generateId(),
    title: "River of Time",
    artist: "Isabella Rossi",
    description: "Flowing water feature integrated with stone sculptures, creating a meditative space that honors the passage of time.",
    imageUri: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800",
    latitude: 40.7470,
    longitude: -73.9903,
    category: "Sculpture",
    dateAdded: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    userId: "seed_user",
    likes: 145,
    visits: 58,
  },
];

const SEED_PROFILE = {
  id: generateId(),
  username: "ArtExplorer",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400",
  bio: "Passionate about discovering and documenting public art in urban spaces.",
  joinedDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  savedArt: [],
};

const SEED_VISITS = [];

const theme = {
  backgroundColor: "#0A0E1A",
  cardColor: "#1A1F2E",
  textColor: "#E8EAF0",
  accentColor: "#6C5CE7",
  secondaryAccent: "#FD79A8",
  borderRadius: 12,
};

export const AppProvider = ({ children }) => {
  const [installations, setInstallations] = useState([]);
  const [profile, setProfile] = useState(null);
  const [visits, setVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [installationsData, profileData, visitsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.INSTALLATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.VISITS),
      ]);

      if (installationsData) {
        setInstallations(JSON.parse(installationsData));
      } else {
        setInstallations(SEED_INSTALLATIONS);
        await AsyncStorage.setItem(STORAGE_KEYS.INSTALLATIONS, JSON.stringify(SEED_INSTALLATIONS));
      }

      if (profileData) {
        setProfile(JSON.parse(profileData));
      } else {
        setProfile(SEED_PROFILE);
        await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(SEED_PROFILE));
      }

      if (visitsData) {
        setVisits(JSON.parse(visitsData));
      } else {
        setVisits(SEED_VISITS);
        await AsyncStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(SEED_VISITS));
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setInstallations(SEED_INSTALLATIONS);
      setProfile(SEED_PROFILE);
      setVisits(SEED_VISITS);
    } finally {
      setIsLoading(false);
    }
  };

  const saveInstallations = useCallback(async (data) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INSTALLATIONS, JSON.stringify(data));
      setInstallations(data);
    } catch (error) {
      console.error("Error saving installations:", error);
    }
  }, []);

  const saveProfile = useCallback(async (data) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(data));
      setProfile(data);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  }, []);

  const saveVisits = useCallback(async (data) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(data));
      setVisits(data);
    } catch (error) {
      console.error("Error saving visits:", error);
    }
  }, []);

  const addArtInstallation = useCallback(async (installation) => {
    const newInstallation = {
      ...installation,
      id: generateId(),
      dateAdded: new Date().toISOString(),
      userId: profile?.id || "unknown",
      likes: 0,
      visits: 0,
    };
    const updated = [newInstallation, ...(installations || [])];
    await saveInstallations(updated);
    return newInstallation;
  }, [installations, profile, saveInstallations]);

  const deleteArtInstallation = useCallback(async (id) => {
    const updated = (installations || []).filter(item => item?.id !== id);
    await saveInstallations(updated);
    
    const updatedProfile = {
      ...(profile || SEED_PROFILE),
      savedArt: ((profile?.savedArt) || []).filter(artId => artId !== id),
    };
    await saveProfile(updatedProfile);
    
    const updatedVisits = (visits || []).filter(visit => visit?.artId !== id);
    await saveVisits(updatedVisits);
  }, [installations, profile, visits, saveInstallations, saveProfile, saveVisits]);

  const updateArtInstallation = useCallback(async (id, updates) => {
    const updated = (installations || []).map(item =>
      item?.id === id ? { ...item, ...updates } : item
    );
    await saveInstallations(updated);
  }, [installations, saveInstallations]);

  const toggleSaveArt = useCallback(async (artId) => {
    if (!profile) return;
    
    const savedArt = (profile?.savedArt) || [];
    const isSaved = savedArt.includes(artId);
    
    const updatedSavedArt = isSaved
      ? savedArt.filter(id => id !== artId)
      : [...savedArt, artId];
    
    const updatedProfile = {
      ...profile,
      savedArt: updatedSavedArt,
    };
    
    await saveProfile(updatedProfile);
    return !isSaved;
  }, [profile, saveProfile]);

  const addVisit = useCallback(async (artId, notes = "") => {
    const newVisit = {
      id: generateId(),
      artId,
      userId: profile?.id || "unknown",
      visitDate: new Date().toISOString(),
      notes,
    };
    
    const updated = [newVisit, ...(visits || [])];
    await saveVisits(updated);
    
    const installation = (installations || []).find(item => item?.id === artId);
    if (installation) {
      await updateArtInstallation(artId, {
        visits: (installation?.visits || 0) + 1,
      });
    }
    
    return newVisit;
  }, [visits, installations, profile, saveVisits, updateArtInstallation]);

  const updateProfile = useCallback(async (updates) => {
    const updatedProfile = {
      ...(profile || SEED_PROFILE),
      ...updates,
    };
    await saveProfile(updatedProfile);
  }, [profile, saveProfile]);

  const savedArt = useMemo(() => {
    const savedIds = (profile?.savedArt) || [];
    return (installations || []).filter(item => savedIds.includes(item?.id));
  }, [installations, profile]);

  const visitedArt = useMemo(() => {
    const visitedIds = new Set((visits || []).map(visit => visit?.artId));
    return (installations || []).filter(item => visitedIds.has(item?.id));
  }, [installations, visits]);

  const nearbyArt = useMemo(() => {
    if (!userLocation) return installations || [];
    
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };
    
    return (installations || [])
      .map(item => ({
        ...item,
        distance: calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          item?.latitude || 0,
          item?.longitude || 0
        ),
      }))
      .sort((a, b) => (a?.distance || 0) - (b?.distance || 0));
  }, [installations, userLocation]);

  const userStats = useMemo(() => {
    const totalAdded = (installations || []).filter(
      item => item?.userId === (profile?.id)
    ).length;
    const totalSaved = ((profile?.savedArt) || []).length;
    const totalVisited = new Set((visits || []).map(visit => visit?.artId)).size;
    const totalLikes = (installations || [])
      .filter(item => item?.userId === (profile?.id))
      .reduce((sum, item) => sum + (item?.likes || 0), 0);
    
    return {
      totalAdded,
      totalSaved,
      totalVisited,
      totalLikes,
    };
  }, [installations, profile, visits]);

  const filteredArt = useCallback((filters = {}) => {
    let result = installations || [];
    
    if (filters.category && filters.category !== "All") {
      result = result.filter(item => item?.category === filters.category);
    }
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        item =>
          (item?.title || "").toLowerCase().includes(query) ||
          (item?.artist || "").toLowerCase().includes(query) ||
          (item?.description || "").toLowerCase().includes(query)
      );
    }
    
    if (filters.sortBy === "distance" && userLocation) {
      const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      
      result = result
        .map(item => ({
          ...item,
          distance: calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            item?.latitude || 0,
            item?.longitude || 0
          ),
        }))
        .sort((a, b) => (a?.distance || 0) - (b?.distance || 0));
    } else if (filters.sortBy === "date") {
      result = [...result].sort((a, b) => {
        const dateA = new Date(a?.dateAdded || 0);
        const dateB = new Date(b?.dateAdded || 0);
        return dateB.getTime() - dateA.getTime();
      });
    } else if (filters.sortBy === "popularity") {
      result = [...result].sort((a, b) => (b?.likes || 0) - (a?.likes || 0));
    }
    
    return result;
  }, [installations, userLocation]);

  const contextValue = {
    installations,
    profile,
    visits,
    isLoading,
    userLocation,
    setUserLocation,
    addArtInstallation,
    deleteArtInstallation,
    updateArtInstallation,
    toggleSaveArt,
    addVisit,
    updateProfile,
    savedArt,
    visitedArt,
    nearbyArt,
    userStats,
    filteredArt,
    theme,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useArtSpotter = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useArtSpotter must be used within an AppProvider");
  }
  return context;
};

export default AppContext;
