import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@feed_posts';
const USERNAME_KEY = '@feed_username';
const FeedContext = createContext();

const SEED = [
  { id: '1', author: 'Alex', body: 'Just shipped a new feature!', likes: 12, liked: false, ts: Date.now() - 3600000 },
  { id: '2', author: 'Jordan', body: 'Anyone tried the new update?', likes: 5, liked: false, ts: Date.now() - 7200000 },
  { id: '3', author: 'Sam', body: 'Beautiful day for coding.', likes: 8, liked: false, ts: Date.now() - 10800000 },
];

export function FeedProvider({ children }) {
  const [posts, setPosts] = useState([]);
  const [username, setUsernameState] = useState('You');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!loading) save(); }, [posts, loading]);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      setPosts(raw ? JSON.parse(raw) : SEED);
      const u = await AsyncStorage.getItem(USERNAME_KEY);
      if (u) setUsernameState(u);
    } catch (_e) { setPosts(SEED); }
    finally { setLoading(false); }
  };
  const save = async () => { try { await AsyncStorage.setItem(KEY, JSON.stringify(posts)); } catch (_e) {} };

  const setUsername = async (name) => {
    const n = (name || '').trim() || 'You';
    setUsernameState(n);
    try { await AsyncStorage.setItem(USERNAME_KEY, n); } catch (_e) {}
  };

  const addPost = (body) => {
    setPosts((p) => [{ id: Date.now().toString(), author: username, body, likes: 0, liked: false, ts: Date.now() }, ...p]);
  };

  const deletePost = (id) => {
    setPosts((p) => p.filter((x) => x.id !== id));
  };

  const toggleLike = (id) => {
    setPosts((p) => p.map((x) => x.id === id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x));
  };

  const clearAll = async () => {
    setPosts([]);
    try { await AsyncStorage.removeItem(KEY); } catch (_e) {}
  };

  const userPosts = useMemo(() => posts.filter((p) => p.author === username || p.author === 'You'), [posts, username]);
  const likedPosts = useMemo(() => posts.filter((p) => p.liked), [posts]);
  const likesGiven = likedPosts.length;
  const likesReceived = useMemo(() => userPosts.reduce((a, p) => a + p.likes, 0), [userPosts]);

  return (
    <FeedContext.Provider value={{
      posts, loading, username, setUsername,
      addPost, deletePost, toggleLike, clearAll,
      userPosts, likedPosts, likesGiven, likesReceived,
    }}>
      {children}
    </FeedContext.Provider>
  );
}

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be inside FeedProvider');
  return ctx;
}
