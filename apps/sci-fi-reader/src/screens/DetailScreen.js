import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';

export default function DetailScreen() {
  const { params } = useRoute();
  const item = params?.item || { name: 'Unknown', value: '' };

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityLabel="Detail">Detail</Text>
      <Text style={styles.name} accessibilityLabel={item.name}>{item.name}</Text>
      <Text style={styles.value} accessibilityLabel={item.value}>{item.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 48, paddingHorizontal: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  name: { fontSize: 20, color: '#fff', marginTop: 16 },
  value: { fontSize: 14, color: '#8b949e', marginTop: 8 },
});
