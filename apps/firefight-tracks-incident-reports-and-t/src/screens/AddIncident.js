import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import MapView, { Marker } from 'react-native-maps';
import { useFireFight } from '../context/FireFightContext';

const { width, height } = Dimensions.get('window');

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#4CAF50', gradient: ['#4CAF50', '#45a049'], icon: 'alert-circle-outline' },
  { value: 'medium', label: 'Medium', color: '#FFA500', gradient: ['#FFA500', '#ff8c00'], icon: 'warning-outline' },
  { value: 'high', label: 'High', color: '#FF6B00', gradient: ['#FF6B00', '#ff5500'], icon: 'flame-outline' },
  { value: 'critical', label: 'Critical', color: '#FF0000', gradient: ['#FF0000', '#cc0000'], icon: 'nuclear-outline' },
];

export default function AddIncident({ navigation }) {
  const { addIncident, team, availableTeam } = useFireFight();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [images, setImages] = useState([]);
  const [assignedTeam, setAssignedTeam] = useState([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [useCustomLocation, setUseCustomLocation] = useState(false);

  const mapRef = useRef(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to auto-fill location.');
        setIsLoadingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setLocation(newLocation);

      const reverseGeocode = await Location.reverseGeocodeAsync(newLocation);
      if (reverseGeocode && reverseGeocode.length > 0) {
        const geo = reverseGeocode[0];
        const formattedAddress = [
          geo.streetNumber,
          geo.street,
          geo.city,
          geo.region,
          geo.postalCode,
        ]
          .filter(Boolean)
          .join(' ');
        setAddress(formattedAddress || 'Unknown Address');
      } else {
        setAddress('Unknown Address');
      }

      if (mapRef.current && newLocation) {
        mapRef.current.animateToRegion({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleMapPress = async (event) => {
    if (!useCustomLocation) return;

    const coordinate = event.nativeEvent.coordinate;
    setLocation(coordinate);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const reverseGeocode = await Location.reverseGeocodeAsync(coordinate);
      if (reverseGeocode && reverseGeocode.length > 0) {
        const geo = reverseGeocode[0];
        const formattedAddress = [
          geo.streetNumber,
          geo.street,
          geo.city,
          geo.region,
          geo.postalCode,
        ]
          .filter(Boolean)
          .join(' ');
        setAddress(formattedAddress || 'Unknown Address');
      } else {
        setAddress('Unknown Address');
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      setAddress('Unknown Address');
    }
  };

  const handleTakePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages([...images, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library permission is required to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages([...images, ...newImages]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemoveImage = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  const toggleTeamMember = (memberId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (assignedTeam.includes(memberId)) {
      setAssignedTeam(assignedTeam.filter(id => id !== memberId));
    } else {
      setAssignedTeam([...assignedTeam, memberId]);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!location) {
      newErrors.location = 'Location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSubmitting(true);

    try {
      const newIncident = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        title: title.trim(),
        description: description.trim(),
        severity,
        status: 'active',
        latitude: location.latitude,
        longitude: location.longitude,
        address: address || 'Unknown Address',
        reportedBy: 'Current User',
        assignedTeam,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        images,
      };

      await addIncident(newIncident);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Success',
        'Incident reported successfully!',
        [
          {
            text: 'View Incident',
            onPress: () => {
              navigation.navigate('Incidents');
            },
          },
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting incident:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to submit incident. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="add-incident-scroll"
        accessibilityLabel="Add incident form scroll view"
      >
        <View style={styles.header}>
          <Ionicons name="flame" size={32} color="#ff4500" />
          <Text style={styles.headerTitle}>Report New Incident</Text>
          <Text style={styles.headerSubtitle}>Fill in the details below</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color="#ff4500" />
            <Text style={styles.sectionTitle}>Incident Details</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="Call sign or location name"
              placeholderTextColor="#666"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) {
                  setErrors({ ...errors, title: null });
                }
              }}
              testID="incident-title-input"
              accessibilityLabel="Incident title input"
            />
            {errors.title && (
              <Text style={styles.errorText}>{errors.title}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.textArea, errors.description && styles.inputError]}
              placeholder="Current conditions and hazards"
              placeholderTextColor="#666"
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (errors.description) {
                  setErrors({ ...errors, description: null });
                }
              }}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              testID="incident-description-input"
              accessibilityLabel="Incident description input"
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning-outline" size={20} color="#ff4500" />
            <Text style={styles.sectionTitle}>Severity Level</Text>
          </View>

          <View style={styles.severityGrid}>
            {SEVERITY_OPTIONS.map((option) => {
              const isSelected = severity === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    setSeverity(option.value);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  activeOpacity={0.7}
                  testID={`severity-${option.value}-button`}
                  accessibilityLabel={`Select ${option.label} severity`}
                >
                  <LinearGradient
                    colors={isSelected ? option.gradient : ['#1a1a1a', '#1a1a1a']}
                    style={[
                      styles.severityCard,
                      isSelected && styles.severityCardSelected,
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={28}
                      color={isSelected ? '#fff' : option.color}
                    />
                    <Text
                      style={[
                        styles.severityLabel,
                        isSelected && styles.severityLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={20} color="#ff4500" />
            <Text style={styles.sectionTitle}>
              Location <Text style={styles.required}>*</Text>
            </Text>
          </View>

          <View style={styles.locationControls}>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getCurrentLocation}
              disabled={isLoadingLocation}
              activeOpacity={0.7}
              testID="get-current-location-button"
              accessibilityLabel="Get current location"
            >
              <LinearGradient
                colors={['#2196F3', '#1976D2']}
                style={styles.locationButtonGradient}
              >
                {isLoadingLocation ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="navigate" size={20} color="#fff" />
                )}
                <Text style={styles.locationButtonText}>
                  {isLoadingLocation ? 'Getting Location...' : 'Use Current Location'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.customLocationToggle}
              onPress={() => {
                setUseCustomLocation(!useCustomLocation);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
              testID="custom-location-toggle"
              accessibilityLabel="Toggle custom location selection"
            >
              <Ionicons
                name={useCustomLocation ? 'checkbox' : 'square-outline'}
                size={20}
                color={useCustomLocation ? '#ff4500' : '#666'}
              />
              <Text style={styles.customLocationText}>Select on Map</Text>
            </TouchableOpacity>
          </View>

          {location && (
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={handleMapPress}
                testID="location-map"
                accessibilityLabel="Location map"
              >
                <Marker
                  coordinate={location}
                  pinColor="#ff4500"
                  testID="location-marker"
                >
                  <View style={styles.markerContainer}>
                    <Ionicons name="flame" size={24} color="#ff4500" />
                  </View>
                </Marker>
              </MapView>
              {useCustomLocation && (
                <View style={styles.mapHint}>
                  <Ionicons name="information-circle" size={16} color="#ff4500" />
                  <Text style={styles.mapHintText}>Tap map to select location</Text>
                </View>
              )}
            </View>
          )}

          {address && (
            <View style={styles.addressContainer}>
              <Ionicons name="location" size={16} color="#ff4500" />
              <Text style={styles.addressText}>{address}</Text>
            </View>
          )}

          {errors.location && (
            <Text style={styles.errorText}>{errors.location}</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera-outline" size={20} color="#ff4500" />
            <Text style={styles.sectionTitle}>Photos</Text>
          </View>

          <View style={styles.photoControls}>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
              testID="take-photo-button"
              accessibilityLabel="Take photo with camera"
            >
              <LinearGradient
                colors={['#ff4500', '#ff6b00']}
                style={styles.photoButtonGradient}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.photoButtonText}>Camera</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoButton}
              onPress={handlePickImage}
              activeOpacity={0.7}
              testID="pick-image-button"
              accessibilityLabel="Pick image from gallery"
            >
              <LinearGradient
                colors={['#ffa500', '#ff8c00']}
                style={styles.photoButtonGradient}
              >
                <Ionicons name="images" size={20} color="#fff" />
                <Text style={styles.photoButtonText}>Gallery</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {images.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageGallery}
              contentContainerStyle={styles.imageGalleryContent}
            >
              {images.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => handleRemoveImage(index)}
                    activeOpacity={0.7}
                    testID={`remove-image-${index}-button`}
                    accessibilityLabel={`Remove image ${index + 1}`}
                  >
                    <LinearGradient
                      colors={['#FF0000', '#cc0000']}
                      style={styles.removeImageGradient}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {images.length === 0 && (
            <View style={styles.emptyPhotos}>
              <Ionicons name="image-outline" size={48} color="#333" />
              <Text style={styles.emptyPhotosText}>No photos added</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={20} color="#ff4500" />
            <Text style={styles.sectionTitle}>Assign Team Members</Text>
          </View>

          {(availableTeam || []).length > 0 ? (
            <View style={styles.teamGrid}>
              {(availableTeam || []).map((member) => {
                const isSelected = assignedTeam.includes(member?.id);
                return (
                  <TouchableOpacity
                    key={member?.id}
                    onPress={() => toggleTeamMember(member?.id)}
                    activeOpacity={0.7}
                    testID={`team-member-${member?.id}-button`}
                    accessibilityLabel={`${isSelected ? 'Deselect' : 'Select'} ${member?.name || 'Unknown'}`}
                  >
                    <View
                      style={[
                        styles.teamCard,
                        isSelected && styles.teamCardSelected,
                      ]}
                    >
                      <View style={styles.teamCardHeader}>
                        <View style={styles.teamAvatar}>
                          <Ionicons
                            name="person"
                            size={20}
                            color={isSelected ? '#fff' : '#ff4500'}
                          />
                        </View>
                        {isSelected && (
                          <View style={styles.teamSelectedBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.teamName,
                          isSelected && styles.teamNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {member?.name || 'Unknown'}
                      </Text>
                      <Text
                        style={[
                          styles.teamRole,
                          isSelected && styles.teamRoleSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {member?.role || 'N/A'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyTeam}>
              <Ionicons name="people-outline" size={48} color="#333" />
              <Text style={styles.emptyTeamText}>No available team members</Text>
            </View>
          )}

          {assignedTeam.length > 0 && (
            <View style={styles.assignedCount}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.assignedCountText}>
                {assignedTeam.length} member{assignedTeam.length !== 1 ? 's' : ''} assigned
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
          testID="submit-incident-button"
          accessibilityLabel="Submit incident report"
        >
          <LinearGradient
            colors={['#ff4500', '#ff6b00']}
            style={styles.submitGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.submitText}>Submit Incident Report</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f5f5f5',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f5f5f5',
    marginLeft: 8,
  },
  required: {
    color: '#ff4500',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  inputError: {
    borderColor: '#ff4500',
  },
  textArea: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minHeight: 100,
  },
  errorText: {
    fontSize: 12,
    color: '#ff4500',
    marginTop: 4,
  },
  severityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  severityCard: {
    width: (width - 44) / 2,
    margin: 6,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    position: 'relative',
  },
  severityCardSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  severityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginTop: 8,
  },
  severityLabelSelected: {
    color: '#fff',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  locationControls: {
    marginBottom: 16,
  },
  locationButton: {
    marginBottom: 12,
  },
  locationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  customLocationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  customLocationText: {
    fontSize: 14,
    color: '#f5f5f5',
    marginLeft: 8,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mapHint: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapHintText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 6,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#f5f5f5',
    marginLeft: 8,
    flex: 1,
  },
  photoControls: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  photoButton: {
    flex: 1,
    marginHorizontal: 6,
  },
  photoButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  imageGallery: {
    marginBottom: 12,
  },
  imageGalleryContent: {
    paddingRight: 16,
  },
  imageContainer: {
    marginRight: 12,
    position: 'relative',
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  removeImageGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhotos: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  emptyPhotosText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  teamCard: {
    width: (width - 44) / 2,
    margin: 6,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  teamCardSelected: {
    backgroundColor: '#2a2a2a',
    borderColor: '#ff4500',
  },
  teamCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  teamAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamSelectedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 4,
  },
  teamNameSelected: {
    color: '#fff',
  },
  teamRole: {
    fontSize: 12,
    color: '#888',
  },
  teamRoleSelected: {
    color: '#aaa',
  },
  emptyTeam: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  emptyTeamText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  assignedCount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 8,
  },
  assignedCountText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 6,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
  },
  submitText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 32,
  },
});
