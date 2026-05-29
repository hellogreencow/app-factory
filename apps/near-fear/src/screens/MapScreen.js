import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Platform, ActivityIndicator, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppData } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const { nearbyDares } = useAppData();

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  let text = 'Waiting...';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = JSON.stringify(location);
  }

  const initialRegion = location ? {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  } : {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  return (
    <View style={styles.container} testID="map-screen-container">
      {location ? (
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={true}
          testID="map-view"
          accessibilityLabel="Map View"
        >
          {nearbyDares && nearbyDares.length > 0 ? (
            nearbyDares
              .filter(dare => dare.location?.latitude && dare.location?.longitude)
              .map((dare) => (
              <Marker
                key={dare.id}
                coordinate={{
                  latitude: dare.location.latitude,
                  longitude: dare.location.longitude,
                }}
                title={dare.title}
                description={dare.description}
                testID={`dare-marker-${dare.id}`}
                accessibilityLabel={`Dare: ${dare.title}`}
              >
                <Ionicons name="flame" size={32} color="#FF4081" />
              </Marker>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>No dares nearby!</Text>
            </View>
          )}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#64FFDA" testID="location-loading-indicator" />
          <Text style={styles.loadingText} testID="location-loading-text">Fetching location...</Text>
          {errorMsg && <Text style={styles.errorText} testID="location-error-text">{errorMsg}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
  },
  errorText: {
    color: '#FF4081',
    fontSize: 16,
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginTop: 10,
  },
});
