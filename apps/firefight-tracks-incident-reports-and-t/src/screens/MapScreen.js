
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../contexts/ThemeContext';
import { useIncident } from '../contexts/IncidentContext';

export default function MapScreen() {
  const { colors } = useTheme();
  const { incidents } = useIncident();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setLoading(false);
          return;
        }

        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
        setLoading(false);
      } catch (error) {
        console.error('Error getting location:', error);
        setErrorMsg('Error getting location');
        setLoading(false);
      }
    })();
  }, []);

  const getMarkerColor = (severity) => {
    switch (severity) {
      case 'critical':
        return '#EF4444';
      case 'high':
        return '#F59E0B';
      case 'medium':
        return '#3B82F6';
      case 'low':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading map...
        </Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          {errorMsg}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            setLoading(true);
            setErrorMsg(null);
            Location.requestForegroundPermissionsAsync().then(({ status }) => {
              if (status === 'granted') {
                Location.getCurrentPositionAsync({}).then((loc) => {
                  setLocation(loc);
                  setLoading(false);
                }).catch(() => {
                  setErrorMsg('Error getting location');
                  setLoading(false);
                });
              } else {
                setErrorMsg('Permission to access location was denied');
                setLoading(false);
              }
            });
          }}
          testID="retry-button"
          accessibilityLabel="Retry loading map"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initialRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }
    : {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

  return (
    <View style={styles.container} testID="map-screen">
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        testID="map-view"
      >
        {incidents.map((incident) => {
          if (incident.location && incident.location.latitude && incident.location.longitude) {
            return (
              <Marker
                key={incident.id}
                coordinate={{
                  latitude: incident.location.latitude,
                  longitude: incident.location.longitude,
                }}
                title={incident.title}
                description={incident.description}
                pinColor={getMarkerColor(incident.severity)}
                testID={`marker-${incident.id}`}
              />
            );
          }
          return null;
        })}
      </MapView>

      <View style={[styles.legend, { backgroundColor: colors.card }]}>
        <Text style={[styles.legendTitle, { color: colors.text }]}>
          Incident Severity
        </Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.legendText, { color: colors.text }]}>Critical</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.legendText, { color: colors.text }]}>High</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={[styles.legendText, { color: colors.text }]}>Medium</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendText, { color: colors.text }]}>Low</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 32,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
  },
});
