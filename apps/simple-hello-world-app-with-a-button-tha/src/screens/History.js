import React, { useContext } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { AppContext } from '../context/AppContext';

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

export default function History() {
  const { presses, deletePress, clearHistory, themes, theme } = useContext(AppContext);

  const confirmClear = () => {
    Alert.alert('Clear history?', 'This will remove all recorded presses.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearHistory },
    ]);
  };

  const renderItem = ({ item }) => {
    if (!item) return null;
    const t = (themes || []).find((th) => th?.id === item.themeId);
    return (
      <View style={[styles.row, { backgroundColor: theme?.cardColor || '#1a1a1a' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.msg, { color: theme?.textColor || '#e0e0e0' }]} numberOfLines={1}>
            {item.message}
          </Text>
          <Text style={styles.meta}>
            {t?.name || 'Theme'} · {formatTime(item.timestamp)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`delete-${item.id}`}
          testID={`delete-${item.id}`}
          onPress={() => deletePress(item.id)}
          style={({ pressed }) => [styles.del, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Text style={styles.delText}>×</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme?.backgroundColor || '#0a0a0a' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme?.textColor || '#e0e0e0' }]}>History</Text>
        {presses && presses.length > 0 ? (
          <Pressable
            accessibilityLabel="clear-history"
            testID="clear-history"
            onPress={confirmClear}
            style={({ pressed }) => [styles.clearBtn, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={presses || []}
        keyExtractor={(item) => String(item?.id || Math.random())}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No presses yet — go tap the Home tab.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  clearBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,80,80,0.2)', borderRadius: 12 },
  clearText: { color: '#ff6b6b', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 10 },
  msg: { fontSize: 16, fontWeight: '600' },
  meta: { color: '#888', fontSize: 12, marginTop: 2 },
  del: { paddingHorizontal: 12, paddingVertical: 4 },
  delText: { color: '#ff6b6b', fontSize: 24, fontWeight: '300' },
  empty: { color: '#666', textAlign: 'center', marginTop: 80, fontSize: 14 },
});
