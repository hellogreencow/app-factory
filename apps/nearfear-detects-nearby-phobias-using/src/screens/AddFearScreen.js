import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useFears } from '../context/AppContext';

const AddFearScreen = () => {
  const { addFear, theme } = useFears();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [sensorData, setSensorData] = useState({});
  const [severity, setSeverity] = useState(5);
  const [locationLoading, setLocationLoading] = useState(false);

  const handleAddFear = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Fear name cannot be empty.');
      return;
    }

    const newFear = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: name,
      description: description,
      location: location,
      sensorData: sensorData,
      severity: severity,
    };

    addFear(newFear);
    setName('');
    setDescription('');
    setLocation(null);
    setSensorData({});
    setSeverity(5);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Fear added successfully!');
  }, [name, description, location, sensorData, severity, addFear]);

  const getLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Permission to access location was denied.');
        return;
      }

      let locationData = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      });

      // Simulate sensor data capture
      setSensorData({
        altitude: locationData.coords.altitude,
        accuracy: locationData.coords.accuracy,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not retrieve location.');
    } finally {
      setLocationLoading(false);
    }
  }, []);

  return (
    <LinearGradient
      colors={[theme.backgroundColor, theme.cardColor]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={[styles.formContainer, { backgroundColor: theme.cardColor }]}>
          <Text style={[styles.title, { color: theme.textColor }]}>Add New Fear</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="ios-text" size={24} color={theme.accentColor} style={styles.icon} testID="name-icon" accessibilityLabel="Name Icon" />
            <TextInput
              style={[styles.input, { color: theme.textColor }]}
              placeholder="What haunts this space?"
              placeholderTextColor={theme.secondaryAccent}
              value={name}
              onChangeText={setName}
              testID="fear-name-input"
              accessibilityLabel="Fear Name Input"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="ios-document-text" size={24} color={theme.accentColor} style={styles.icon} testID="description-icon" accessibilityLabel="Description Icon" />
            <TextInput
              style={[styles.input, { color: theme.textColor }]}
              placeholder="Description"
              placeholderTextColor={theme.secondaryAccent}
              value={description}
              onChangeText={setDescription}
              multiline
              testID="fear-description-input"
              accessibilityLabel="Fear Description Input"
            />
          </View>

          <View style={styles.locationContainer}>
            <Text style={[styles.locationTitle, { color: theme.textColor }]}>Location</Text>
            {location ? (
              <View>
                <Text style={[styles.locationText, { color: theme.textColor }]} testID="location-display" accessibilityLabel="Location Display">
                  Latitude: {location.latitude.toFixed(5)}, Longitude: {location.longitude.toFixed(5)}
                </Text>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  testID="map-view"
                  accessibilityLabel="Map View"
                >
                  <Marker
                    coordinate={{
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }}
                    title="Fear Location"
                    testID="map-marker"
                    accessibilityLabel="Map Marker"
                  />
                </MapView>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.locationButton}
                onPress={getLocation}
                disabled={locationLoading}
                testID="get-location-button"
                accessibilityLabel="Get Location Button"
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color={theme.textColor} />
                ) : (
                  <>
                    <Ionicons name="location-outline" size={20} color={theme.textColor} style={{ marginRight: 5 }} />
                    <Text style={[styles.locationButtonText, { color: theme.textColor }]}>Get Current Location</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddFear}
            testID="add-fear-button"
            accessibilityLabel="Seal into Atlas Button"
          >
            <Text style={styles.addButtonText}>Add Fear</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  formContainer: {
    borderRadius: 8,
    padding: 20,
    marginVertical: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: '#272727',
    paddingHorizontal: 10,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 40,
    paddingVertical: 10,
  },
  locationContainer: {
    marginBottom: 20,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  locationText: {
    marginBottom: 10,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BB86FC',
    padding: 12,
    borderRadius: 8,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 10,
  },
  addButton: {
    backgroundColor: '#03DAC5',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AddFearScreen;
