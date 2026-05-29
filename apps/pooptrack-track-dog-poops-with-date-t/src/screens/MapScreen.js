import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppContext } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const generateTestID = (base) => `map-screen-${base}`;

export default function MapScreen() {
  const { theme, poops } = useContext(AppContext);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [initialRegion, setInitialRegion] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);

      setInitialRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      });
    })();
  }, []);

  let text = 'Waiting...';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = JSON.stringify(location);
  }

  const renderMapContent = () => {
    if (!initialRegion) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme?.accentColor} testID={generateTestID('loading-indicator')} />
          <Text style={[styles.loadingText, { color: theme?.textColor }]} testID={generateTestID('loading-text')}>Loading map...</Text>
        </View>
      );
    }

    return (
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        testID={generateTestID('map-view')}
        accessibilityLabel="Map with poop locations"
      >
        {(poops || []).map((poop) => (
          <Marker
            key={poop.id}
            coordinate={poop.location}
            title="Poop Location"
            description={poop.notes}
            testID={generateTestID(`poop-marker-${poop.id}`)}
            accessibilityLabel={`Poop marker at latitude ${poop.location.latitude} and longitude ${poop.location.longitude}`}
          >
            <Ionicons name="ios-poop" size={32} color="#795548" />
          </Marker>
        ))}
      </MapView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme?.backgroundColor }]}>
      {renderMapContent()}
      {!initialRegion && (
        <LinearGradient
          colors={[theme?.backgroundColor || '#121212', 'transparent']}
          style={styles.gradientOverlay}
        />
      )}
      {initialRegion && (poops || []).length === 0 && (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="ios-information-circle-outline" size={48} color={theme?.accentColor} testID={generateTestID('empty-state-icon')} />
          <Text style={[styles.emptyStateText, { color: theme?.textColor }]} testID={generateTestID('empty-state-text')}>No poops recorded yet.</Text>
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  emptyStateContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 18,
    textAlign: 'center',
  },
});
