import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useReference } from '../context/ReferenceContext';

export default function BrowseScreen() {
  const { filtered, categories, activeCategory, setActiveCategory, search, setSearch } = useReference();
  const nav = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Browse">Browse</Text>
      <TextInput style={styles.searchBar} placeholder="Search..." placeholderTextColor="#8b949e" value={search} onChangeText={setSearch} testID="search-input" accessibilityLabel="Search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsInner}>
        {categories.map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, activeCategory === c && styles.chipActive]} onPress={() => setActiveCategory(c)} testID={`cat-${c}`} accessibilityLabel={c}>
            <Text style={[styles.chipText, activeCategory === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={styles.count} accessibilityLabel={`${filtered.length} results`}>{filtered.length} results</Text>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => nav.navigate('ItemDetail', { id: item.id })} testID={`item-${item.id}`} accessibilityLabel={item.title}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.badge}>{item.category}</Text>
            </View>
            <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
            {item.bookmarked && <Text style={styles.bookmark}>★</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No results</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  searchBar: { backgroundColor: '#161b22', color: '#c9d1d9', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 12 },
  chips: { maxHeight: 44, marginBottom: 12 },
  chipsInner: { gap: 8, alignItems: 'center' },
  chip: { backgroundColor: '#21262d', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16 },
  chipActive: { backgroundColor: '#1f6feb' },
  chipText: { color: '#8b949e', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  count: { color: '#8b949e', fontSize: 13, marginBottom: 8 },
  card: { backgroundColor: '#161b22', borderRadius: 12, padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '600', flex: 1 },
  badge: { backgroundColor: '#21262d', color: '#8b949e', fontSize: 11, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  cardBody: { color: '#8b949e', fontSize: 14, lineHeight: 20 },
  bookmark: { color: '#e3b341', fontSize: 16, position: 'absolute', top: 12, right: 12 },
  empty: { color: '#8b949e', textAlign: 'center', marginTop: 24 },
});
