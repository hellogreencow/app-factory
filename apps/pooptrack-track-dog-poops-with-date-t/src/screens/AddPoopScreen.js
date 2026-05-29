import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

import { AppContext } from '../context/AppContext';

const generateTestID = (base) => `add-poop-screen-${base}`;

export default function AddPoopScreen() {
  const { theme, addPoop } = useContext(AppContext);

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(format(new Date(), 'hh:mm a'));
  const [location, setLocation] = useState(null);
  const [consistency, setConsistency] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please enable location permissions to use this feature.');
      } else {
        getCurrentLocation();
      }

      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cameraStatus === 'granted');
    })();
  }, []);

  const getCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert('Error', 'Could not retrieve location. Please try again.');
    }
  };

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert('Error', 'Could not pick image. Please try again.');
    }
  };

  const takePicture = async () => {
    if (!hasCameraPermission) {
      Alert.alert('Permission denied', 'Please enable camera permissions to use this feature.');
      return;
    }

    try {
      let result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert('Error', 'Could not take picture. Please try again.');
    }
  };

  const savePoopEntry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newPoop = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      date: date.getTime(),
      time,
      location,
      consistency,
      color,
      notes,
      photo,
    };

    try {
      await addPoop(newPoop);
      Alert.alert('Success', 'Poop entry saved!');
      setDate(new Date());
      setTime(format(new Date(), 'hh:mm a'));
      setLocation(null);
      setConsistency('');
      setColor('');
      setNotes('');
      setPhoto(null);
    } catch (error) {
      console.error("Error saving poop entry:", error);
      Alert.alert('Error', 'Could not save poop entry. Please try again.');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme?.backgroundColor }]}
      contentContainerStyle={styles.contentContainer}
    >
      <LinearGradient
        colors={[theme?.secondaryAccent, theme?.accentColor]}
        style={styles.headerGradient}
      >
        <Text style={styles.headerText}>Add New Poop</Text>
      </LinearGradient>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Ionicons name="calendar-outline" size={24} color={theme?.accentColor} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Date (Tap to set)"
            placeholderTextColor="gray"
            value={format(date, 'MMMM dd, yyyy')}
            onFocus={() => {
              // Implement date picker here
            }}
            editable={false}
            testID={generateTestID('date-input')}
            accessibilityLabel="Date"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="time-outline" size={24} color={theme?.accentColor} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Time (Tap to set)"
            placeholderTextColor="gray"
            value={time}
            onFocus={() => {
              // Implement time picker here
            }}
            editable={false}
            testID={generateTestID('time-input')}
            accessibilityLabel="Time"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="pin-outline" size={24} color={theme?.accentColor} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Location (Auto)"
            placeholderTextColor="gray"
            value={location ? `Lat: ${location.latitude.toFixed(2)}, Lng: ${location.longitude.toFixed(2)}` : 'Fetching...'}
            editable={false}
            testID={generateTestID('location-input')}
            accessibilityLabel="Location"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="water-outline" size={24} color={theme?.accentColor} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Consistency"
            placeholderTextColor="gray"
            value={consistency}
            onChangeText={setConsistency}
            testID={generateTestID('consistency-input')}
            accessibilityLabel="Consistency"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="color-palette-outline" size={24} color={theme?.accentColor} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Color"
            placeholderTextColor="gray"
            value={color}
            onChangeText={setColor}
            testID={generateTestID('color-input')}
            accessibilityLabel="Color"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="document-text-outline" size={24} color={theme?.accentColor} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Notes"
            placeholderTextColor="gray"
            value={notes}
            onChangeText={setNotes}
            multiline
            testID={generateTestID('notes-input')}
            accessibilityLabel="Notes"
          />
        </View>

        <View style={styles.photoSection}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.poopImage} testID={generateTestID('poop-image')} accessibilityLabel="Poop Photo" />
          ) : (
            <Text style={[styles.noPhotoText, { color: theme?.textColor }]}>No photo selected</Text>
          )}

          <View style={styles.photoButtons}>
            <TouchableOpacity
              style={[styles.photoButton, { backgroundColor: theme?.cardColor }]}
              onPress={pickImage}
              testID={generateTestID('pick-image-button')}
              accessibilityLabel="Pick Image"
            >
              <Ionicons name="image-outline" size={20} color={theme?.accentColor} />
              <Text style={[styles.photoButtonText, { color: theme?.textColor }]}>Pick Image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.photoButton, { backgroundColor: theme?.cardColor }]}
              onPress={takePicture}
              testID={generateTestID('take-photo-button')}
              accessibilityLabel="Take Photo"
            >
              <Ionicons name="camera-outline" size={20} color={theme?.accentColor} />
              <Text style={[styles.photoButtonText, { color: theme?.textColor }]}>Take Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={savePoopEntry}
          testID={generateTestID('save-button')}
          accessibilityLabel="Save Poop Entry"
        >
          <LinearGradient
            colors={[theme?.accentColor, theme?.secondaryAccent]}
            style={styles.saveButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.saveButtonText}>Save Poop Entry</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  headerGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#212121',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 40,
    paddingVertical: 10,
  },
  photoSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  poopImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  noPhotoText: {
    fontStyle: 'italic',
    marginBottom: 10,
  },
  photoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  photoButtonText: {
    marginLeft: 5,
  },
  saveButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
