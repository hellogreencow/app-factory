import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { useAppData } from '../context/AppContext';

const { width } = Dimensions.get('window');

const CreateDareScreen = () => {
  const { addDare, getUser } = useAppData();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [video, setVideo] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationErrorMsg, setLocationErrorMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);

  useEffect(() => {
    (async () => {
      // Location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationErrorMsg('Permission to access location was denied');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      setMapRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      // Camera permissions
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(cameraStatus.status === 'granted');
      setHasCameraPermission(cameraStatus.status === 'granted');
    })();
  }, []);

  const pickVideo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setVideo(result.assets[0].uri);
    }
  };

  const recordVideo = async () => {
    if (!cameraPermission) {
      console.warn("Camera permission not granted");
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setVideo(result.assets[0].uri);
    }
  };

  const handleLocationChange = (e) => {
    setLocation({
      latitude: e.nativeEvent.coordinate.latitude,
      longitude: e.nativeEvent.coordinate.longitude,
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (!title || !description || !video || !location) {
        alert("Please fill in all fields and select a video and location.");
        return;
      }

      const newDare = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        title,
        description,
        videoUrl: video, // In a real app, upload this to a server
        location,
        creatorId: getUser()?.id || 'default_user', // Replace with actual user ID
        createdAt: new Date().toISOString(),
        likes: 0,
      };

      await addDare(newDare);
      setTitle('');
      setDescription('');
      setVideo(null);
      setLocation(null);
      alert('Dare created successfully!');
    } catch (error) {
      console.error("Error creating dare:", error);
      alert("Failed to create dare.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasCameraPermission === null) {
    return <View />;
  }
  if (hasCameraPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <SafeAreaView style={styles.container} testID="create-dare-screen">
      <LinearGradient
        colors={['#121212', '#1E1E1E']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Create a Dare</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="text" size={20} color="#A9A9A9" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#A9A9A9"
              value={title}
              onChangeText={setTitle}
              testID="dare-title-input"
              accessibilityLabel="Dare Title Input"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="document-text-outline" size={20} color="#A9A9A9" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Description"
              placeholderTextColor="#A9A9A9"
              value={description}
              onChangeText={setDescription}
              multiline
              testID="dare-description-input"
              accessibilityLabel="Dare Description Input"
            />
          </View>

          <Text style={styles.label}>Video:</Text>
          <View style={styles.videoButtons}>
            <TouchableOpacity
              style={styles.videoButton}
              onPress={pickVideo}
              testID="upload-video-button"
              accessibilityLabel="Upload Video"
            >
              <Ionicons name="cloud-upload-outline" size={24} color="#64FFDA" />
              <Text style={styles.videoButtonText}>Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.videoButton}
              onPress={recordVideo}
              testID="record-video-button"
              accessibilityLabel="Record Video"
            >
              <Ionicons name="camera-outline" size={24} color="#64FFDA" />
              <Text style={styles.videoButtonText}>Record</Text>
            </TouchableOpacity>
          </View>

          {video && (
            <View style={styles.videoPreview}>
              <Text style={styles.videoPreviewText}>Video Selected!</Text>
            </View>
          )}

          <Text style={styles.label}>Location:</Text>
          {location ? (
            <MapView
              style={styles.map}
              region={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              testID="location-map"
              accessibilityLabel="Location Map"
            >
              <Marker
                coordinate={location}
                draggable
                onDragEnd={handleLocationChange}
                testID="location-marker"
                accessibilityLabel="Location Marker"
              >
                <Ionicons name="location" size={32} color="#FF4081" />
              </Marker>
            </MapView>
          ) : (
            <View style={styles.locationPlaceholder}>
              {locationErrorMsg ? (
                <Text style={styles.locationError}>{locationErrorMsg}</Text>
              ) : (
                <ActivityIndicator size="large" color="#64FFDA" />
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isSubmitting}
            testID="submit-dare-button"
            accessibilityLabel="Submit Dare"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Create Dare</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    width: '100%',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 40,
    color: '#FFFFFF',
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 5,
    alignSelf: 'flex-start',
  },
  videoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 15,
  },
  videoButton: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    flexDirection: 'row',
  },
  videoButtonText: {
    color: '#64FFDA',
    marginLeft: 5,
  },
  videoPreview: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  videoPreviewText: {
    color: '#FFFFFF',
  },
  map: {
    width: width - 40,
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
  },
  locationPlaceholder: {
    width: width - 40,
    height: 200,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  locationError: {
    color: '#FF4081',
    fontSize: 16,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#64FFDA',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  submitButtonText: {
    color: '#121212',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 5,
  },
});

export default CreateDareScreen;
