
import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFears } from '../context/AppContext';
import { theme } from '../context/AppContext';

export default function MapScreen() {
  const { fears } = useFears();
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

  let text = 'Waiting for location...';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = JSON.stringify(location);
  }

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          showsUserLocation={true}
          testID="map-view"
          accessibilityLabel="Map View"
        >
          {fears.map((fear) => (
            <Marker
              key={fear.id}
              coordinate={fear.location}
              title={fear.name}
              description={fear.description}
              testID={`marker-${fear.id}`}
              accessibilityLabel={`Marker for ${fear.name}`}
            />
          ))}
        </MapView>
      ) : (
        <Text style={styles.text}>{errorMsg || 'Loading map...'}</Text>
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
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});
