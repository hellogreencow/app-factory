import React, { useContext, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';

const { width: SCREEN_W } = Dimensions.get('window');
// Map a (lat, lng) into the container as a 0..1 normalized position with a simple equirectangular projection over a fixed world window
const PROJECT_BOUNDS = { minLat: -60, maxLat: 75, minLng: -180, maxLng: 180 };

const project = (lat, lng) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const x = (lng - PROJECT_BOUNDS.minLng) / (PROJECT_BOUNDS.maxLng - PROJECT_BOUNDS.minLng);
  const y = 1 - (lat - PROJECT_BOUNDS.minLat) / (PROJECT_BOUNDS.maxLat - PROJECT_BOUNDS.minLat);
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
};

const DebtMap = () => {
  const { debts, debtsByLocation } = useContext(AppContext);

  const points = useMemo(() => {
    const arr = [];
    Object.entries(debtsByLocation || {}).forEach(([key, list]) => {
      if (!Array.isArray(list) || list.length === 0) return;
      const [latStr, lngStr] = key.split(',');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      const p = project(lat, lng);
      if (!p) return;
      const total = list.reduce((s, d) => s + (Number(d?.amount) || 0), 0);
      const active = list.filter((d) => d?.status === 'active').length;
      arr.push({ key, ...p, count: list.length, active, total });
    });
    return arr;
  }, [debtsByLocation]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.h1}>Debt Map</Text>
        <Text style={styles.subtitle}>{debts?.length || 0} debts across {points.length} locations</Text>

        <View style={styles.mapArea}>
          {/* Equator + Prime meridian reference lines */}
          <View style={[styles.gridLine, { top: '50%' }]} />
          <View style={[styles.gridLineV, { left: '50%' }]} />

          {points.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="map-outline" size={48} color="#444" />
              <Text style={styles.empty}>No locations to plot yet.</Text>
            </View>
          ) : (
            points.map((pt) => {
              const size = 28 + Math.min(28, pt.count * 4);
              return (
                <View
                  key={pt.key}
                  accessibilityLabel={`map-point-${pt.key}`}
                  testID={`map-point-${pt.key}`}
                  style={[
                    styles.point,
                    {
                      left: `${pt.x * 100}%`,
                      top: `${pt.y * 100}%`,
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      marginLeft: -size / 2,
                      marginTop: -size / 2,
                    },
                  ]}
                >
                  <Text style={styles.pointText}>{pt.active || pt.count}</Text>
                </View>
              );
            })
          )}
        </View>

        <FlatList
          data={Object.entries(debtsByLocation || {}).map(([k, v]) => ({ key: k, list: v }))}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const total = (item.list || []).reduce((s, d) => s + (Number(d?.amount) || 0), 0);
            return (
              <View style={styles.legendRow}>
                <Ionicons name="location" size={14} color="#39FF14" />
                <Text style={styles.legendText} numberOfLines={1}>
                  {item.list[0]?.debtorName || 'Unknown'} · {item.list.length} debt{item.list.length === 1 ? '' : 's'} · ${total.toFixed(2)}
                </Text>
              </View>
            );
          }}
          style={styles.legend}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={null}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, backgroundColor: '#000000', paddingTop: 20 },
  h1: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', paddingHorizontal: 20 },
  subtitle: { color: '#888', fontSize: 13, paddingHorizontal: 20, marginTop: 4, marginBottom: 16 },
  mapArea: { height: SCREEN_W * 0.9, marginHorizontal: 16, backgroundColor: '#0A0A0A', borderRadius: 16, borderWidth: 1, borderColor: '#1A1A1A', position: 'relative', overflow: 'hidden' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(57,255,20,0.1)' },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(57,255,20,0.1)' },
  point: { position: 'absolute', backgroundColor: 'rgba(57,255,20,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000' },
  pointText: { color: '#000000', fontSize: 11, fontWeight: '800' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#666', marginTop: 8, fontSize: 14 },
  legend: { flex: 1, marginTop: 12, marginHorizontal: 16, backgroundColor: '#0A0A0A', borderRadius: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  legendText: { color: '#bbb', fontSize: 13, flex: 1 },
});

export default DebtMap;
