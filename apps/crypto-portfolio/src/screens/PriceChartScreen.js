import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getPrice } from '../data/prices';

// Simple bar chart representation (no external chart lib for minimal deps)
function SimpleChart({ data }) {
  const max = Math.max(...data);
  return (
    <View style={chartStyles.container}>
      {data.map((v, i) => (
        <View key={i} style={chartStyles.barWrap}>
          <View style={[chartStyles.bar, { height: `${(v / max) * 100}%` }]} />
        </View>
      ))}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4, marginVertical: 16 },
  barWrap: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: '#58a6ff', borderRadius: 4, minHeight: 4 },
});

export default function PriceChartScreen() {
  const { params } = useRoute();
  const asset = params?.asset;
  if (!asset) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>No asset selected</Text>
      </View>
    );
  }

  const price = getPrice(asset.symbol);
  const value = (asset.amount || 0) * price;
  // Mock 7-day price history (slight variation)
  const history = [0.92, 0.94, 0.96, 0.98, 1, 0.97, 1].map((m) => price * m);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.symbol} accessibilityLabel={`${asset.symbol} chart`}>
        {asset.symbol}
      </Text>
      <Text style={styles.price}>${price.toLocaleString()}</Text>
      <Text style={styles.holdings}>Holdings: {asset.amount} ({asset.symbol})</Text>
      <Text style={styles.value}>Value: ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
      <Text style={styles.chartLabel}>7-day trend (mock)</Text>
      <SimpleChart data={history} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 48, paddingHorizontal: 16 },
  error: { color: '#f85149', fontSize: 16 },
  symbol: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  price: { fontSize: 24, color: '#58a6ff', marginTop: 4 },
  holdings: { fontSize: 16, color: '#8b949e', marginTop: 8 },
  value: { fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 4 },
  chartLabel: { fontSize: 14, color: '#8b949e', marginTop: 24 },
});
