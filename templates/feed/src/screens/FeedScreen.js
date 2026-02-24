import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFeed } from '../context/FeedContext';

export default function FeedScreen() {
  const { posts, toggleLike } = useFeed();
  const nav = useNavigation();

  const timeAgo = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 60) return `${m}m`;
    if (m < 1440) return `${Math.floor(m / 60)}h`;
    return `${Math.floor(m / 1440)}d`;
  };

  const renderPost = ({ item }) => (
    <View style={styles.card} testID={`post-${item.id}`}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{item.author[0]}</Text></View>
        <Text style={styles.author}>{item.author}</Text>
        <Text style={styles.time}>{timeAgo(item.ts)}</Text>
      </View>
      <Text style={styles.body}>{item.body}</Text>
      <TouchableOpacity style={styles.likeBtn} onPress={() => toggleLike(item.id)} testID={`like-${item.id}`} accessibilityLabel={`Like ${item.author}`}>
        <Text style={[styles.likeText, item.liked && styles.liked]}>{item.liked ? '♥' : '♡'} {item.likes}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Feed">Feed</Text>
      <TouchableOpacity style={styles.composeBtn} onPress={() => nav.navigate('Compose')} testID="compose-btn" accessibilityLabel="Compose">
        <Text style={styles.composeBtnText}>+ New Post</Text>
      </TouchableOpacity>
      <FlatList data={posts} keyExtractor={(i) => i.id} renderItem={renderPost} contentContainerStyle={styles.list} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', paddingHorizontal: 16, paddingTop: 16 },
  composeBtn: { backgroundColor: '#1f6feb', margin: 16, padding: 14, borderRadius: 24, alignItems: 'center' },
  composeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: '#161b22', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#30363d', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: '#58a6ff', fontWeight: '700', fontSize: 16 },
  author: { color: '#fff', fontWeight: '600', flex: 1 },
  time: { color: '#8b949e', fontSize: 12 },
  body: { color: '#c9d1d9', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  likeBtn: { paddingVertical: 4 },
  likeText: { color: '#8b949e', fontSize: 15 },
  liked: { color: '#f85149' },
});
