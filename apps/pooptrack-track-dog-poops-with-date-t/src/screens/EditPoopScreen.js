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
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { AppContext } from '../context/AppContext';

const generateTestID = (base) => `edit-poop-screen-${base}`;

export default function EditPoopScreen({ route, navigation }) {
  const { theme, updatePoop, deletePoop } = useContext(AppContext);
  const { id } = route?.params ?? {};

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(format(new Date(), 'hh:mm a'));
  const [location, setLocation] = useState(null);
  const [consistency, setConsistency] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [poop, setPoop] = useState(null);

  useEffect(() => {
    if (!id) {
      Alert.alert('Error', 'Poop ID not found.');
      return;
    }

    const loadPoop = async () => {
      try {
        const storedPoops = await AsyncStorage.getItem('@pooptrack_poops');
        if (storedPoops) {
          const poops = JSON.parse(storedPoops);
          const poopToEdit = poops?.find((p) => p.id === id);

          if (poopToEdit) {
            setPoop(poopToEdit);
            const safeDate = new Date(poopToEdit.date);
            const safeDateFinal = isNaN(safeDate.getTime()) ? new Date() : safeDate;
            setDate(safeDateFinal);
            setTime(poopToEdit.time);
            setLocation(poopToEdit.location);
            setConsistency(poopToEdit.consistency);
            setColor(poopToEdit.color);
            setNotes(poopToEdit.notes);
            setPhoto(poopToEdit.photo);
          } else {
            Alert.alert('Error', 'Poop not found.');
          }
        } else {
          Alert.alert('Error', 'No poops found.');
        }
      } catch (error) {
        console.error('Error loading poop:', error);
        Alert.alert('Error', 'Could not load poop. Please try again.');
      }
    };

    loadPoop();
  }, [id]);

  if (!id || !poop) {
    return (
      <View style={[styles.container, { backgroundColor: theme?.backgroundColor }]}>
        <Text style={[styles.errorText, { color: theme?.textColor }]}>
          Poop not found.
        </Text>
      </View>
    );
  }

  const getCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
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
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not pick image. Please try again.');
    }
  };

  const updatePoopEntry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const updatedPoop = {
        ...poop,
        date: date.getTime(),
        time,
        location,
        consistency,
        color,
        notes,
        photo,
      };

      await updatePoop(updatedPoop);
      navigation.goBack();
    } catch (error) {
      console.error('Error updating poop:', error);
      Alert.alert('Error', 'Could not update poop. Please try again.');
    }
  };

  const deletePoopEntry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Poop',
      'Are you sure you want to delete this poop entry?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: async () => {
            try {
              await deletePoop(poop.id);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting poop:', error);
              Alert.alert('Error', 'Could not delete poop. Please try again.');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <LinearGradient
      colors={[theme?.backgroundColor, theme?.cardColor]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={[styles.title, { color: theme?.textColor }]} testID={generateTestID('title')}>
          Edit Poop
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons name="calendar-outline" size={24} color={theme?.accentColor} style={styles.icon} testID={generateTestID('date-icon')} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor={theme?.textColor}
            value={format(date, 'yyyy-MM-dd')}
            onChangeText={(text) => {
              const d = new Date(text);
              const safe = isNaN(d.getTime()) ? new Date() : d;
              setDate(safe);
            }}
            testID={generateTestID('date-input')}
            accessibilityLabel="Date"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="time-outline" size={24} color={theme?.accentColor} style={styles.icon} testID={generateTestID('time-icon')} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Time (HH:MM AM/PM)"
            placeholderTextColor={theme?.textColor}
            value={time}
            onChangeText={setTime}
            testID={generateTestID('time-input')}
            accessibilityLabel="Time"
          />
        </View>

        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
          testID={generateTestID('location-button')}
          accessibilityLabel="Get Current Location"
        >
          <Ionicons name="location-outline" size={24} color={theme?.textColor} />
          <Text style={[styles.locationButtonText, { color: theme?.textColor }]}>
            Get Current Location
          </Text>
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <Ionicons name="color-palette-outline" size={24} color={theme?.accentColor} style={styles.icon} testID={generateTestID('color-icon')} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Color"
            placeholderTextColor={theme?.textColor}
            value={color}
            onChangeText={setColor}
            testID={generateTestID('color-input')}
            accessibilityLabel="Color"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="water-outline" size={24} color={theme?.accentColor} style={styles.icon} testID={generateTestID('consistency-icon')} />
          <TextInput
            style={[styles.input, { color: theme?.textColor }]}
            placeholder="Consistency"
            placeholderTextColor={theme?.textColor}
            value={consistency}
            onChangeText={setConsistency}
            testID={generateTestID('consistency-input')}
            accessibilityLabel="Consistency"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="document-text-outline" size={24} color={theme?.accentColor} style={styles.icon} testID={generateTestID('notes-icon')} />
          <TextInput
            style={[styles.inputMultiline, { color: theme?.textColor }]}
            placeholder="Notes"
            placeholderTextColor={theme?.textColor}
            value={notes}
            onChangeText={setNotes}
            multiline
            testID={generateTestID('notes-input')}
            accessibilityLabel="Notes"
          />
        </View>

        <TouchableOpacity
          style={styles.imageButton}
          onPress={pickImage}
          testID={generateTestID('image-button')}
          accessibilityLabel="Pick Image"
        >
          <Ionicons name="image-outline" size={24} color={theme?.textColor} />
          <Text style={[styles.imageButtonText, { color: theme?.textColor }]}>
            Pick Image
          </Text>
        </TouchableOpacity>

        {photo && (
          <Image source={{ uri: photo }} style={styles.imagePreview} testID={generateTestID('image-preview')} accessibilityLabel="Poop Image" />
        )}

        <TouchableOpacity
          style={styles.saveButton}
          onPress={updatePoopEntry}
          testID={generateTestID('save-button')}
          accessibilityLabel="Save Poop"
        >
          <Ionicons name="save-outline" size={24} color={theme?.textColor} />
          <Text style={[styles.saveButtonText, { color: theme?.textColor }]}>
            Save
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={deletePoopEntry}
          testID={generateTestID('delete-button')}
          accessibilityLabel="Delete Poop"
        >
          <Ionicons name="trash-outline" size={24} color={theme?.textColor} />
          <Text style={[styles.deleteButtonText, { color: theme?.textColor }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#212121',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    width: '90%',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 40,
    paddingVertical: 10,
  },
  inputMultiline: {
    flex: 1,
    height: 80,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BB86FC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    width: '90%',
  },
  locationButtonText: {
    marginLeft: 5,
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#03DAC5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    width: '90%',
  },
  imageButtonText: {
    marginLeft: 5,
    fontSize: 16,
    fontWeight: 'bold',
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6200EE',
    borderRadius: 8,
    padding: 12,
    width: '90%',
    marginBottom: 15,
  },
  saveButtonText: {
    marginLeft: 5,
    fontSize: 18,
    fontWeight: 'bold',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CF6679',
    borderRadius: 8,
    padding: 12,
    width: '90%',
  },
  deleteButtonText: {
    marginLeft: 5,
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
