import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useReference } from '../context/ReferenceContext';

export default function BookmarksScreen() {
  const { bookmarked } = useReference();
  const nav = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Bookmarks">Bookmarks</Text>
      <FlatList
        data={bookmarked}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => nav.navigate('Home', { screen: 'BrowseHome', params: { screen: 'ItemDetail', params: { id: item.id } } })} testID={`bm-${item.id}`} accessibilityLabel={item.title}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowCat}>{item.category}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No bookmarks yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  row: { backgroundColor: '#161b22', padding: 16, borderRadius: 10, marginBottom: 8 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowCat: { color: '#8b949e', fontSize: 13, marginTop: 4 },
  empty: { color: '#8b949e', textAlign: 'center', marginTop: 24 },
});
