import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DreamDriftContext = createContext();

const STORAGE_KEYS = {
  sounds: '@dreamdrift_sounds',
  mixes: '@dreamdrift_mixes',
  sessions: '@dreamdrift_sessions',
  settings: '@dreamdrift_settings',
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const INITIAL_SOUNDS = [
  {
    id: generateId(),
    name: "Stormy Night",
    category: "rain",
    icon: "rainy",
    color: "#4a90e2",
    audioFile: "heavy_rain.mp3",
    isFavorite: false,
  },
  {
    id: generateId(),
    name: "Gentle Rain",
    category: "rain",
    icon: "water",
    color: "#5ca3e8",
    audioFile: "gentle_rain.mp3",
    isFavorite: true,
  },
  {
    id: generateId(),
    name: "Ocean Waves",
    category: "ocean",
    icon: "boat",
    color: "#2196f3",
    audioFile: "ocean_waves.mp3",
    isFavorite: true,
  },
  {
    id: generateId(),
    name: "Beach Surf",
    category: "ocean",
    icon: "sunny",
    color: "#03a9f4",
    audioFile: "beach_surf.mp3",
    isFavorite: false,
  },
  {
    id: generateId(),
    name: "Ancient Woods",
    category: "forest",
    icon: "leaf",
    color: "#4caf50",
    audioFile: "forest_night.mp3",
    isFavorite: false,
  },
  {
    id: generateId(),
    name: "Birds Chirping",
    category: "forest",
    icon: "musical-note",
    color: "#66bb6a",
    audioFile: "birds_chirping.mp3",
    isFavorite: true,
  },
  {
    id: generateId(),
    name: "Thunderstorm",
    category: "rain",
    icon: "thunderstorm",
    color: "#5e35b1",
    audioFile: "thunderstorm.mp3",
    isFavorite: false,
  },
  {
    id: generateId(),
    name: "White Noise",
    category: "ambient",
    icon: "radio",
    color: "#9e9e9e",
    audioFile: "white_noise.mp3",
    isFavorite: false,
  },
];

const INITIAL_MIXES = [
  {
    id: generateId(),
    name: "Midnight Rain & Pines",
    sounds: [INITIAL_SOUNDS[1].id, INITIAL_SOUNDS[4].id],
    volumes: {
      [INITIAL_SOUNDS[1].id]: 0.7,
      [INITIAL_SOUNDS[4].id]: 0.5,
    },
    createdAt: Date.now() - 86400000 * 3,
    isFavorite: true,
  },
  {
    id: generateId(),
    name: "Coastal Solitude",
    sounds: [INITIAL_SOUNDS[2].id, INITIAL_SOUNDS[3].id],
    volumes: {
      [INITIAL_SOUNDS[2].id]: 0.8,
      [INITIAL_SOUNDS[3].id]: 0.6,
    },
    createdAt: Date.now() - 86400000 * 7,
    isFavorite: false,
  },
];

const INITIAL_SESSIONS = [
  {
    id: generateId(),
    soundIds: [INITIAL_SOUNDS[1].id, INITIAL_SOUNDS[5].id],
    duration: 3600,
    completedAt: Date.now() - 86400000 * 1,
  },
  {
    id: generateId(),
    soundIds: [INITIAL_SOUNDS[2].id],
    duration: 1800,
    completedAt: Date.now() - 86400000 * 2,
  },
  {
    id: generateId(),
    soundIds: [INITIAL_SOUNDS[0].id, INITIAL_SOUNDS[4].id],
    duration: 2700,
    completedAt: Date.now() - 86400000 * 5,
  },
  {
    id: generateId(),
    soundIds: [INITIAL_SOUNDS[6].id],
    duration: 3600,
    completedAt: Date.now() - 86400000 * 8,
  },
  {
    id: generateId(),
    soundIds: [INITIAL_SOUNDS[2].id, INITIAL_SOUNDS[3].id],
    duration: 5400,
    completedAt: Date.now() - 86400000 * 10,
  },
];

const INITIAL_SETTINGS = {
  defaultTimer: 1800,
  fadeOutDuration: 300,
  masterVolume: 0.8,
  theme: "dark",
};

export const DreamDriftProvider = ({ children }) => {
  const [sounds, setSounds] = useState(INITIAL_SOUNDS);
  const [mixes, setMixes] = useState(INITIAL_MIXES);
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  
  const [playingSounds, setPlayingSounds] = useState({});
  const [volumes, setVolumes] = useState({});
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [timerDuration, setTimerDuration] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentMixId, setCurrentMixId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveData('sounds', sounds);
  }, [sounds]);

  useEffect(() => {
    saveData('mixes', mixes);
  }, [mixes]);

  useEffect(() => {
    saveData('sessions', sessions);
  }, [sessions]);

  useEffect(() => {
    saveData('settings', settings);
  }, [settings]);

  const loadData = async () => {
    try {
      const soundsData = await AsyncStorage.getItem(STORAGE_KEYS.sounds);
      const mixesData = await AsyncStorage.getItem(STORAGE_KEYS.mixes);
      const sessionsData = await AsyncStorage.getItem(STORAGE_KEYS.sessions);
      const settingsData = await AsyncStorage.getItem(STORAGE_KEYS.settings);

      if (soundsData) {
        setSounds(JSON.parse(soundsData));
      }
      if (mixesData) {
        setMixes(JSON.parse(mixesData));
      }
      if (sessionsData) {
        setSessions(JSON.parse(sessionsData));
      }
      if (settingsData) {
        setSettings(JSON.parse(settingsData));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveData = async (key, data) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  };

  const playSound = useCallback((soundId) => {
    setPlayingSounds(prev => ({
      ...prev,
      [soundId]: true,
    }));
    if (!volumes[soundId]) {
      setVolumes(prev => ({
        ...prev,
        [soundId]: settings.masterVolume || 0.8,
      }));
    }
  }, [volumes, settings.masterVolume]);

  const pauseSound = useCallback((soundId) => {
    setPlayingSounds(prev => ({
      ...prev,
      [soundId]: false,
    }));
  }, []);

  const stopAll = useCallback(() => {
    setPlayingSounds({});
    setVolumes({});
    setCurrentMixId(null);
  }, []);

  const setVolume = useCallback((soundId, volume) => {
    setVolumes(prev => ({
      ...prev,
      [soundId]: Math.max(0, Math.min(1, volume)),
    }));
  }, []);

  const addToMix = useCallback((soundId) => {
    playSound(soundId);
  }, [playSound]);

  const removeFromMix = useCallback((soundId) => {
    setPlayingSounds(prev => {
      const updated = { ...prev };
      delete updated[soundId];
      return updated;
    });
    setVolumes(prev => {
      const updated = { ...prev };
      delete updated[soundId];
      return updated;
    });
  }, []);

  const saveMix = useCallback((name) => {
    const activeSoundIds = Object.keys(playingSounds).filter(id => playingSounds[id]);
    
    if (activeSoundIds.length === 0) {
      return null;
    }

    const newMix = {
      id: generateId(),
      name: name || `Mix ${mixes.length + 1}`,
      sounds: activeSoundIds,
      volumes: { ...volumes },
      createdAt: Date.now(),
      isFavorite: false,
    };

    setMixes(prev => [...prev, newMix]);
    setCurrentMixId(newMix.id);
    return newMix;
  }, [playingSounds, volumes, mixes.length]);

  const deleteMix = useCallback((mixId) => {
    setMixes(prev => prev.filter(mix => mix.id !== mixId));
    if (currentMixId === mixId) {
      setCurrentMixId(null);
    }
  }, [currentMixId]);

  const toggleFavorite = useCallback((type, id) => {
    if (type === 'sound') {
      setSounds(prev => prev.map(sound => 
        sound.id === id ? { ...sound, isFavorite: !sound.isFavorite } : sound
      ));
    } else if (type === 'mix') {
      setMixes(prev => prev.map(mix => 
        mix.id === id ? { ...mix, isFavorite: !mix.isFavorite } : mix
      ));
    }
  }, []);

  const startTimer = useCallback((durationSeconds) => {
    const duration = durationSeconds || settings.defaultTimer || 1800;
    setTimerDuration(duration);
    setTimerEndTime(Date.now() + duration * 1000);
    setIsTimerRunning(true);
  }, [settings.defaultTimer]);

  const stopTimer = useCallback(() => {
    setTimerEndTime(null);
    setTimerDuration(null);
    setIsTimerRunning(false);
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings,
    }));
  }, []);

  const logSession = useCallback((soundIds, duration) => {
    const newSession = {
      id: generateId(),
      soundIds: soundIds || [],
      duration: duration || 0,
      completedAt: Date.now(),
    };
    setSessions(prev => [...prev, newSession]);
  }, []);

  const activeSounds = useMemo(() => {
    return Object.keys(playingSounds)
      .filter(id => playingSounds[id])
      .map(id => sounds.find(s => s.id === id))
      .filter(Boolean);
  }, [playingSounds, sounds]);

  const currentMix = useMemo(() => {
    if (!currentMixId) return null;
    return mixes.find(mix => mix.id === currentMixId) || null;
  }, [currentMixId, mixes]);

  const timerRemaining = useMemo(() => {
    if (!timerEndTime || !isTimerRunning) return 0;
    const remaining = Math.max(0, Math.floor((timerEndTime - Date.now()) / 1000));
    return remaining;
  }, [timerEndTime, isTimerRunning]);

  const totalSessions = useMemo(() => {
    return sessions.length;
  }, [sessions]);

  const favoriteCount = useMemo(() => {
    const favoriteSounds = sounds.filter(s => s.isFavorite).length;
    const favoriteMixes = mixes.filter(m => m.isFavorite).length;
    return favoriteSounds + favoriteMixes;
  }, [sounds, mixes]);

  const isPlaying = useMemo(() => {
    return Object.values(playingSounds).some(playing => playing);
  }, [playingSounds]);

  const theme = useMemo(() => ({
    backgroundColor: '#0a0e27',
    textColor: '#e8eaf6',
    accentColor: '#7c4dff',
    cardColor: '#1a1f3a',
  }), []);

  const value = {
    sounds,
    mixes,
    sessions,
    settings,
    playingSounds,
    volumes,
    playSound,
    pauseSound,
    stopAll,
    setVolume,
    addToMix,
    removeFromMix,
    saveMix,
    deleteMix,
    toggleFavorite,
    startTimer,
    stopTimer,
    updateSettings,
    logSession,
    activeSounds,
    currentMix,
    timerRemaining,
    totalSessions,
    favoriteCount,
    isPlaying,
    theme,
  };

  return (
    <DreamDriftContext.Provider value={value}>
      {children}
    </DreamDriftContext.Provider>
  );
};

export const useDreamDrift = () => {
  const context = useContext(DreamDriftContext);
  if (!context) {
    throw new Error('useDreamDrift must be used within a DreamDriftProvider');
  }
  return context;
};

export default DreamDriftContext;
