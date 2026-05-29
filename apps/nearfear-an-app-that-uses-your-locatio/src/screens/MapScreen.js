
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useAppData } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function MapScreen() {
  const { places, theme } = useAppData();
  const navigation = useNavigation();
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

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

  let initialRegion = location ? {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  } : {
    latitude: 37.78825, // Default location if location is not available
    longitude: -122.4324,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  };

  const getColorForFearRating = (rating) => {
    if (rating >= 4) {
      return '#9B2226';
    } else if (rating >= 3) {
      return '#BB3E03';
    } else {
      return '#EE9B00';
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        testID="map-view"
        accessibilityLabel="Map view"
      >
        {(places || []).map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={place.name}
            pinColor={getColorForFearRating(place.fearRating)}
            onCalloutPress={() => navigation.navigate('PlaceDetails', { id: place.id })}
            testID={`marker-${place.id}`}
            accessibilityLabel={`Marker for ${place.name}`}
          >
            <View style={[styles.markerView, { backgroundColor: getColorForFearRating(place.fearRating) }]}>
              <Text style={styles.markerText}>{place.fearRating}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
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
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  markerView: {
    borderRadius: 10,
    padding: 5,
  },
  markerText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
