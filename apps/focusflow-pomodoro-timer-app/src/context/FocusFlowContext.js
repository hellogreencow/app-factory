import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startOfDay, startOfWeek, startOfMonth, differenceInDays, parseISO, isValid } from 'date-fns';

const FocusFlowContext = createContext();

const SESSIONS_KEY = '@focusflow_sessions';
const SETTINGS_KEY = '@focusflow_settings';

const defaultSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  soundEnabled: true,
  hapticsEnabled: true,
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const seedSessions = [
  {
    id: generateId(),
    type: 'work',
    duration: 25,
    completedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    interrupted: false,
  },
  {
    id: generateId(),
    type: 'shortBreak',
    duration: 5,
    completedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    interrupted: false,
  },
  {
    id: generateId(),
    type: 'work',
    duration: 25,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    interrupted: false,
  },
  {
    id: generateId(),
    type: 'work',
    duration: 25,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    interrupted: false,
  },
  {
    id: generateId(),
    type: 'shortBreak',
    duration: 5,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 30).toISOString(),
    interrupted: false,
  },
  {
    id: generateId(),
    type: 'work',
    duration: 25,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    interrupted: true,
  },
  {
    id: generateId(),
    type: 'longBreak',
    duration: 15,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    interrupted: false,
  },
  {
    id: generateId(),
    type: 'work',
    duration: 25,
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    interrupted: false,
  },
];

const theme = {
  backgroundColor: '#0f0f1a',
  textColor: '#e0e0e8',
  accentColor: '#6366f1',
  cardColor: '#1a1a2e',
};

export const FocusFlowProvider = ({ children }) => {
  const [sessions, setSessions] = useState(seedSessions);
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveSessions();
    }
  }, [sessions, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveSettings();
    }
  }, [settings, isLoading]);

  const loadData = async () => {
    try {
      const [sessionsData, settingsData] = await Promise.all([
        AsyncStorage.getItem(SESSIONS_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
      ]);

      if (sessionsData) {
        const parsed = JSON.parse(sessionsData);
        setSessions(Array.isArray(parsed) ? parsed : seedSessions);
      }

      if (settingsData) {
        const parsed = JSON.parse(settingsData);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSessions = async () => {
    try {
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const addSession = useCallback((session) => {
    const newSession = {
      id: generateId(),
      type: session.type || 'work',
      duration: session.duration || 25,
      completedAt: session.completedAt || new Date().toISOString(),
      interrupted: session.interrupted || false,
    };
    setSessions((prev) => [newSession, ...(prev || [])]);
  }, []);

  const completeSession = useCallback((type, duration, interrupted = false) => {
    const newSession = {
      id: generateId(),
      type,
      duration,
      completedAt: new Date().toISOString(),
      interrupted,
    };
    setSessions((prev) => [newSession, ...(prev || [])]);
  }, []);

  const deleteSession = useCallback((sessionId) => {
    setSessions((prev) => (prev || []).filter((s) => s?.id !== sessionId));
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const resetAllData = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([SESSIONS_KEY, SETTINGS_KEY]);
      setSessions([]);
      setSettings(defaultSettings);
    } catch (error) {
      console.error('Error resetting data:', error);
    }
  }, []);

  const todaySessions = useMemo(() => {
    const today = startOfDay(new Date());
    return (sessions || []).filter((session) => {
      if (!session?.completedAt) return false;
      const sessionDate = new Date(session.completedAt);
      if (!isValid(sessionDate)) return false;
      const sessionDay = startOfDay(sessionDate);
      return sessionDay.getTime() === today.getTime();
    });
  }, [sessions]);

  const weekStats = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekSessions = (sessions || []).filter((session) => {
      if (!session?.completedAt) return false;
      const sessionDate = new Date(session.completedAt);
      if (!isValid(sessionDate)) return false;
      return sessionDate >= weekStart;
    });

    const totalSessions = weekSessions.length;
    const workSessions = weekSessions.filter((s) => s?.type === 'work').length;
    const breakSessions = weekSessions.filter((s) => s?.type === 'shortBreak' || s?.type === 'longBreak').length;
    const totalMinutes = weekSessions.reduce((sum, s) => sum + (s?.duration || 0), 0);
    const completedSessions = weekSessions.filter((s) => !s?.interrupted).length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    return {
      totalSessions,
      workSessions,
      breakSessions,
      totalMinutes,
      completionRate: Math.round(completionRate),
      sessions: weekSessions,
    };
  }, [sessions]);

  const monthStats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const monthSessions = (sessions || []).filter((session) => {
      if (!session?.completedAt) return false;
      const sessionDate = new Date(session.completedAt);
      if (!isValid(sessionDate)) return false;
      return sessionDate >= monthStart;
    });

    const totalSessions = monthSessions.length;
    const workSessions = monthSessions.filter((s) => s?.type === 'work').length;
    const breakSessions = monthSessions.filter((s) => s?.type === 'shortBreak' || s?.type === 'longBreak').length;
    const totalMinutes = monthSessions.reduce((sum, s) => sum + (s?.duration || 0), 0);
    const completedSessions = monthSessions.filter((s) => !s?.interrupted).length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    return {
      totalSessions,
      workSessions,
      breakSessions,
      totalMinutes,
      completionRate: Math.round(completionRate),
      sessions: monthSessions,
    };
  }, [sessions]);

  const currentStreak = useMemo(() => {
    if (!sessions || sessions.length === 0) return 0;

    const sortedSessions = [...sessions].sort((a, b) => {
      const dateA = new Date(a?.completedAt || 0);
      const dateB = new Date(b?.completedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const sessionDays = new Set();
    sortedSessions.forEach((session) => {
      if (!session?.completedAt) return;
      const date = new Date(session.completedAt);
      if (!isValid(date)) return;
      const dayKey = startOfDay(date).getTime();
      sessionDays.add(dayKey);
    });

    const uniqueDays = Array.from(sessionDays).sort((a, b) => b - a);
    if (uniqueDays.length === 0) return 0;

    let streak = 0;
    const today = startOfDay(new Date()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;

    if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) {
      return 0;
    }

    let expectedDay = uniqueDays[0];
    for (const day of uniqueDays) {
      if (day === expectedDay) {
        streak++;
        expectedDay -= 24 * 60 * 60 * 1000;
      } else {
        break;
      }
    }

    return streak;
  }, [sessions]);

  const longestStreak = useMemo(() => {
    if (!sessions || sessions.length === 0) return 0;

    const sessionDays = new Set();
    sessions.forEach((session) => {
      if (!session?.completedAt) return;
      const date = new Date(session.completedAt);
      if (!isValid(date)) return;
      const dayKey = startOfDay(date).getTime();
      sessionDays.add(dayKey);
    });

    const uniqueDays = Array.from(sessionDays).sort((a, b) => a - b);
    if (uniqueDays.length === 0) return 0;

    let maxStreak = 1;
    let currentStreakCount = 1;

    for (let i = 1; i < uniqueDays.length; i++) {
      const dayDiff = (uniqueDays[i] - uniqueDays[i - 1]) / (24 * 60 * 60 * 1000);
      if (dayDiff === 1) {
        currentStreakCount++;
        maxStreak = Math.max(maxStreak, currentStreakCount);
      } else {
        currentStreakCount = 1;
      }
    }

    return maxStreak;
  }, [sessions]);

  const totalFocusTime = useMemo(() => {
    return (sessions || [])
      .filter((s) => s?.type === 'work' && !s?.interrupted)
      .reduce((sum, s) => sum + (s?.duration || 0), 0);
  }, [sessions]);

  const value = {
    sessions,
    settings,
    addSession,
    deleteSession,
    updateSettings,
    resetAllData,
    completeSession,
    todaySessions,
    weekStats,
    monthStats,
    currentStreak,
    longestStreak,
    totalFocusTime,
    theme,
    isLoading,
  };

  return <FocusFlowContext.Provider value={value}>{children}</FocusFlowContext.Provider>;
};

export const useFocusFlow = () => {
  const context = useContext(FocusFlowContext);
  if (context === undefined) {
    throw new Error('useFocusFlow must be used within a FocusFlowProvider');
  }
  return context;
};

export default FocusFlowContext;
