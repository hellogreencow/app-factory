
import React, { useState, useContext } from 'react';
import { StyleSheet, View, Text, TextInput, Button, ScrollView, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useAppData } from '../context/AppContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const initialRegion = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: LATITUDE_DELTA,
  longitudeDelta: LONGITUDE_DELTA,
};

const fearTagsList = ['haunted', 'creepy alley', 'spiderwebs', 'dark forest', 'abandoned'];

export default function AddPlaceScreen() {
  const { addPlace, theme } = useAppData();
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(initialRegion.latitude);
  const [longitude, setLongitude] = useState(initialRegion.longitude);
  const [fearRating, setFearRating] = useState(1);
  const [fearTags, setFearTags] = useState([]);
  const [markerCoordinate, setMarkerCoordinate] = useState({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
  });

  const handleAddPlace = () => {
    const newPlace = {
      name,
      latitude,
      longitude,
      fearRating,
      fearTags,
    };
    addPlace(newPlace);
    setName('');
    setLatitude(initialRegion.latitude);
    setLongitude(initialRegion.longitude);
    setFearRating(1);
    setFearTags([]);
    setMarkerCoordinate({
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
    });
    alert('Place added!');
  };

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    setLatitude(coordinate.latitude);
    setLongitude(coordinate.longitude);
    setMarkerCoordinate(coordinate);
  };

  const toggleFearTag = (tag) => {
    if (fearTags.includes(tag)) {
      setFearTags(fearTags.filter((t) => t !== tag));
    } else {
      setFearTags([...fearTags, tag]);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.label, { color: theme.textColor }]}>Name:</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardColor, color: theme.textColor }]}
          value={name}
          onChangeText={setName}
          placeholder="What do they call this place?"
          placeholderTextColor={theme.textColor}
          testID="place-name-input"
          accessibilityLabel="Place Name"
        />

        <Text style={[styles.label, { color: theme.textColor }]}>Fear Rating (1-5):</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardColor, color: theme.textColor }]}
          value={fearRating.toString()}
          onChangeText={(text) => {
            const parsedValue = parseInt(text, 10);
            if (!isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 5) {
              setFearRating(parsedValue);
            }
          }}
          keyboardType="number-pad"
          placeholder="Fear Rating (1-5)"
          placeholderTextColor={theme.textColor}
          testID="fear-rating-input"
          accessibilityLabel="Fear Rating (1-5)"
        />

        <Text style={[styles.label, { color: theme.textColor }]}>Select Location:</Text>
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          onPress={handleMapPress}
          testID="map-picker"
          accessibilityLabel="Map picker"
        >
          <Marker coordinate={markerCoordinate} testID="map-marker" accessibilityLabel="Map marker" />
        </MapView>
        <Text style={[styles.coordinatesText, { color: theme.textColor }]}>
          Latitude: {latitude.toFixed(6)}, Longitude: {longitude.toFixed(6)}
        </Text>

        <Text style={[styles.label, { color: theme.textColor }]}>Fear Tags:</Text>
        <View style={styles.tagsContainer}>
          {fearTagsList.map((tag) => (
            <Button
              key={tag}
              title={tag}
              onPress={() => toggleFearTag(tag)}
              color={fearTags.includes(tag) ? theme.accentColor : theme.secondaryAccent}
              testID={`tag-button-${tag}`}
              accessibilityLabel={`Tag ${tag}`}
            />
          ))}
        </View>

        <Button
          title="Mark this spot"
          onPress={handleAddPlace}
          color={theme.accentColor}
          testID="add-place-button"
          accessibilityLabel="Add Place"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  map: {
    width: '100%',
    height: 200,
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  coordinatesText: {
    fontSize: 14,
    marginBottom: 10,
  },
});
