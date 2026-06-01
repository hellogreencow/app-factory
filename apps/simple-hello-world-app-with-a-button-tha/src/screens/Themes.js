import React, { useContext } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';

export default function Themes() {
  const { themes, selectedTheme, setTheme, theme } = useContext(AppContext);

  const renderItem = ({ item }) => {
    if (!item) return null;
    const gradient = Array.isArray(item.gradient) && item.gradient.length >= 2 ? item.gradient : ['#333', '#666'];
    const isActive = selectedTheme?.id === item.id;
    return (
      <Pressable
        accessibilityLabel={`theme-${item.id}`}
        testID={`theme-${item.id}`}
        onPress={() => setTheme(item.id)}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
      >
        <LinearGradient colors={gradient} style={styles.gradient}>
          {isActive ? (
            <View style={styles.check}>
              <Ionicons name="checkmark-circle" size={32} color="#ffffff" />
            </View>
          ) : null}
          <Text style={styles.name}>{item.name}</Text>
          {Array.isArray(item.messages) ? (
            <Text style={styles.preview} numberOfLines={1}>{item.messages[0]}</Text>
          ) : null}
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme?.backgroundColor || '#0a0a0a' }]}>
      <Text style={[styles.title, { color: theme?.textColor || '#e0e0e0' }]}>Themes</Text>
      <FlatList
        data={themes || []}
        keyExtractor={(item, i) => String(item?.id || i)}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 20, marginBottom: 16 },
  card: { flex: 1, borderRadius: 18, overflow: 'hidden' },
  gradient: { aspectRatio: 1, padding: 16, justifyContent: 'flex-end' },
  name: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  preview: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  check: { position: 'absolute', top: 10, right: 10 },
});
