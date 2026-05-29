import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DebtMap() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>DebtMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
});
