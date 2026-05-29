import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@feed_posts';
const FeedContext = createContext();

const SEED = [
  { id: '1', author: 'Alex', body: 'Just shipped a new feature!', likes: 12, liked: false, ts: Date.now() - 3600000 },
  { id: '2', author: 'Jordan', body: 'Anyone tried the new update?', likes: 5, liked: false, ts: Date.now() - 7200000 },
  { id: '3', author: 'Sam', body: 'Beautiful day for coding.', likes: 8, liked: false, ts: Date.now() - 10800000 },
];

export function FeedProvider({ children }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!loading) save(); }, [posts, loading]);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      setPosts(raw ? JSON.parse(raw) : SEED);
    } catch (_e) { setPosts(SEED); }
    finally { setLoading(false); }
  };
  const save = async () => { try { await AsyncStorage.setItem(KEY, JSON.stringify(posts)); } catch (_e) { /* persist best-effort */ } };

  const addPost = (body) => {
    setPosts((p) => [{ id: Date.now().toString(), author: 'You', body, likes: 0, liked: false, ts: Date.now() }, ...p]);
  };
  const toggleLike = (id) => {
    setPosts((p) => p.map((x) => x.id === id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x));
  };

  return (
    <FeedContext.Provider value={{ posts, loading, addPost, toggleLike }}>
      {children}
    </FeedContext.Provider>
  );
}

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be inside FeedProvider');
  return ctx;
}
