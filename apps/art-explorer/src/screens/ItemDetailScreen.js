import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useReference } from '../context/ReferenceContext';

export default function ItemDetailScreen() {
  const route = useRoute();
  const { getItem, toggleBookmark } = useReference();
  const item = getItem(route.params?.id);

  if (!item) return <View style={styles.container}><Text style={styles.empty}>Not found</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.badge}>{item.category}</Text>
      <Text style={styles.title} accessibilityLabel={item.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
      <TouchableOpacity style={[styles.bmBtn, item.bookmarked && styles.bmBtnActive]} onPress={() => toggleBookmark(item.id)} testID="toggle-bookmark" accessibilityLabel={item.bookmarked ? 'Remove Bookmark' : 'Bookmark'}>
        <Text style={styles.bmBtnText}>{item.bookmarked ? '★ Bookmarked' : '☆ Bookmark'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  badge: { color: '#58a6ff', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  body: { color: '#c9d1d9', fontSize: 16, lineHeight: 24 },
  bmBtn: { backgroundColor: '#21262d', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  bmBtnActive: { backgroundColor: '#1c2d1f' },
  bmBtnText: { color: '#e3b341', fontSize: 16, fontWeight: '600' },
  empty: { color: '#8b949e', textAlign: 'center', marginTop: 60 },
});
