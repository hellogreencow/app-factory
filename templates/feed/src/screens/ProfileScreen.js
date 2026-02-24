import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFeed } from '../context/FeedContext';

export default function ProfileScreen() {
  const { posts } = useFeed();
  const myPosts = posts.filter((p) => p.author === 'You');
  const totalLikes = myPosts.reduce((a, p) => a + p.likes, 0);

  return (
    <View style={styles.container}>
      <View style={styles.avatarLarge}><Text style={styles.avatarText}>Y</Text></View>
      <Text style={styles.name} accessibilityLabel="Profile">You</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum} testID="post-count">{myPosts.length}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum} testID="like-count">{totalLikes}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', alignItems: 'center', paddingTop: 60 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#30363d', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { color: '#58a6ff', fontSize: 32, fontWeight: '700' },
  name: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 40 },
  stat: { alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 28, fontWeight: '700' },
  statLabel: { color: '#8b949e', fontSize: 14, marginTop: 4 },
});
