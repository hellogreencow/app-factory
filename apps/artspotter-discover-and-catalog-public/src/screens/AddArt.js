import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useArtSpotter } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'Mural', label: 'Mural', icon: 'color-palette' },
  { id: 'Sculpture', label: 'Sculpture', icon: 'cube' },
  { id: 'Installation', label: 'Installation', icon: 'bulb' },
  { id: 'Street Art', label: 'Street Art', icon: 'brush' },
  { id: 'Digital', label: 'Digital', icon: 'phone-portrait' },
];

export default function AddArt({ navigation }) {
  const { addArtInstallation } = useArtSpotter();

  const [captureMode, setCaptureMode] = useState('select');
  const [imageUri, setImageUri] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Mural');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const cameraRef = useRef(null);
  const successScale = useSharedValue(0);
  const saveButtonScale = useSharedValue(1);

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    if (imageUri && !location) {
      getLocation();
    }
  }, [imageUri]);

  const requestPermissions = async () => {
    try {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(cameraStatus.status === 'granted');

      const locationStatus = await Location.requestForegroundPermissionsAsync();
      if (locationStatus.status === 'granted') {
        getLocation();
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const getLocation = async () => {
    setLocationLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Could not get current location. You can still save the art.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraPermission) {
      Alert.alert('Camera Permission', 'Camera permission is required to take photos.');
      return;
    }
    setCaptureMode('camera');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleCapturePhoto = async () => {
    if (cameraRef.current && cameraReady) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });
        setImageUri(photo.uri);
        setCaptureMode('preview');
      } catch (error) {
        console.error('Capture error:', error);
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  const handlePickImage = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setCaptureMode('preview');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRetake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImageUri(null);
    setCaptureMode('select');
  };

  const validateForm = () => {
    const newErrors = {};

    if (!title || title.trim().length === 0) {
      newErrors.title = 'Title is required';
    }

    if (!artist || artist.trim().length === 0) {
      newErrors.artist = 'Artist name is required';
    }

    if (!imageUri) {
      newErrors.image = 'Please capture or select an image';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    saveButtonScale.value = withSequence(
      withSpring(0.9),
      withSpring(1)
    );

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const newInstallation = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        title: title.trim(),
        artist: artist.trim(),
        description: description.trim(),
        imageUri,
        latitude: location?.latitude || 40.7580,
        longitude: location?.longitude || -73.9855,
        category: selectedCategory,
        dateAdded: new Date().toISOString(),
        userId: 'current_user',
        likes: 0,
        visits: 0,
      };

      await addArtInstallation(newInstallation);

      setShowSuccess(true);
      successScale.value = withSequence(
        withSpring(1.2),
        withSpring(1)
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setShowSuccess(false);
        resetForm();
        if (navigation && typeof navigation.navigate === 'function') {
          navigation.navigate('Discover');
        }
      }, 2000);

    } catch (error) {
      console.error('Save error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save art installation');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setImageUri(null);
    setTitle('');
    setArtist('');
    setDescription('');
    setSelectedCategory('Mural');
    setErrors({});
    setCaptureMode('select');
  };

  const successAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: successScale.value }],
      opacity: successScale.value,
    };
  });

  const saveButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: saveButtonScale.value }],
    };
  });

  if (showSuccess) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.successContainer, successAnimatedStyle]}>
          <LinearGradient
            colors={['#6C5CE7', '#A29BFE']}
            style={styles.successGradient}
          >
            <Ionicons name="checkmark-circle" size={80} color="#FFF" />
            <Text style={styles.successTitle}>Art Added!</Text>
            <Text style={styles.successSubtitle}>Your installation has been saved</Text>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  }

  if (captureMode === 'camera') {
    return (
      <View style={styles.container}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={Camera.Constants.Type.back}
          onCameraReady={() => setCameraReady(true)}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => {
                  setCaptureMode('select');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                testID="camera-close-button"
                accessibilityLabel="Close camera"
              >
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.cameraFooter}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={handleCapturePhoto}
                disabled={!cameraReady}
                testID="capture-photo-button"
                accessibilityLabel="Capture photo"
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </View>
        </Camera>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#1A1F2E', '#0A0E1A']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Add New Art</Text>
          <Text style={styles.headerSubtitle}>Catalog a public art installation</Text>
        </LinearGradient>

        <View style={styles.imageSection}>
          {imageUri ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={handleRetake}
                testID="retake-photo-button"
                accessibilityLabel="Retake photo"
              >
                <Ionicons name="camera-reverse" size={20} color="#FFF" />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={64} color="#6C5CE7" />
              <Text style={styles.placeholderText}>Add a photo of the art</Text>
              <View style={styles.imageButtonsRow}>
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={handleTakePhoto}
                  testID="take-photo-button"
                  accessibilityLabel="Take photo with camera"
                >
                  <LinearGradient
                    colors={['#6C5CE7', '#5F4FD1']}
                    style={styles.imageButtonGradient}
                  >
                    <Ionicons name="camera" size={24} color="#FFF" />
                    <Text style={styles.imageButtonText}>Camera</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={handlePickImage}
                  testID="pick-image-button"
                  accessibilityLabel="Pick image from gallery"
                >
                  <LinearGradient
                    colors={['#FD79A8', '#E84393']}
                    style={styles.imageButtonGradient}
                  >
                    <Ionicons name="images" size={24} color="#FFF" />
                    <Text style={styles.imageButtonText}>Gallery</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              {errors.image && (
                <Text style={styles.errorText}>{errors.image}</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <Ionicons name="location" size={20} color="#6C5CE7" />
            <Text style={styles.locationTitle}>Location</Text>
          </View>
          {locationLoading ? (
            <View style={styles.locationLoading}>
              <ActivityIndicator size="small" color="#6C5CE7" />
              <Text style={styles.locationLoadingText}>Getting location...</Text>
            </View>
          ) : location ? (
            <View style={styles.locationInfo}>
              <Ionicons name="checkmark-circle" size={16} color="#00B894" />
              <Text style={styles.locationText}>
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.locationRetry}
              onPress={getLocation}
              testID="retry-location-button"
              accessibilityLabel="Retry getting location"
            >
              <Ionicons name="refresh" size={16} color="#6C5CE7" />
              <Text style={styles.locationRetryText}>Tap to get location</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Ionicons name="text" size={18} color="#6C5CE7" />
              <Text style={styles.inputLabel}>Title *</Text>
            </View>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="Enter art title"
              placeholderTextColor="#6B7280"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) {
                  setErrors({ ...errors, title: null });
                }
              }}
              testID="title-input"
              accessibilityLabel="Art title input"
            />
            {errors.title && (
              <Text style={styles.errorText}>{errors.title}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Ionicons name="person" size={18} color="#6C5CE7" />
              <Text style={styles.inputLabel}>Artist *</Text>
            </View>
            <TextInput
              style={[styles.input, errors.artist && styles.inputError]}
              placeholder="Enter artist name"
              placeholderTextColor="#6B7280"
              value={artist}
              onChangeText={(text) => {
                setArtist(text);
                if (errors.artist) {
                  setErrors({ ...errors, artist: null });
                }
              }}
              testID="artist-input"
              accessibilityLabel="Artist name input"
            />
            {errors.artist && (
              <Text style={styles.errorText}>{errors.artist}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Ionicons name="document-text" size={18} color="#6C5CE7" />
              <Text style={styles.inputLabel}>Description</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the artwork (optional)"
              placeholderTextColor="#6B7280"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              testID="description-input"
              accessibilityLabel="Art description input"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Ionicons name="pricetag" size={18} color="#6C5CE7" />
              <Text style={styles.inputLabel}>Category</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {(CATEGORIES || []).map((category) => {
                const isSelected = selectedCategory === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}
                    onPress={() => {
                      setSelectedCategory(category.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    testID={`category-${category.id}-button`}
                    accessibilityLabel={`Select ${category.label} category`}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={['#6C5CE7', '#5F4FD1']}
                        style={styles.categoryChipGradient}
                      >
                        <Ionicons name={category.icon} size={18} color="#FFF" />
                        <Text style={styles.categoryChipTextSelected}>
                          {category.label}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <>
                        <Ionicons name={category.icon} size={18} color="#6C5CE7" />
                        <Text style={styles.categoryChipText}>
                          {category.label}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <Animated.View style={saveButtonAnimatedStyle}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
            testID="save-installation-button"
            accessibilityLabel="Save art installation"
          >
            <LinearGradient
              colors={['#6C5CE7', '#5F4FD1']}
              style={styles.saveButtonGradient}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  <Text style={styles.saveButtonText}>Save Installation</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E8EAF0',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  imageSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  imagePreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1F2E',
  },
  imagePreview: {
    width: '100%',
    height: 280,
    resizeMode: 'cover',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  retakeButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePlaceholder: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2F3E',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 15,
    marginTop: 12,
    marginBottom: 20,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  imageButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  locationSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8EAF0',
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderRadius: 12,
  },
  locationLoadingText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderRadius: 12,
  },
  locationText: {
    color: '#E8EAF0',
    fontSize: 14,
    fontWeight: '500',
  },
  locationRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderRadius: 12,
  },
  locationRetryText: {
    color: '#6C5CE7',
    fontSize: 14,
    fontWeight: '500',
  },
  formSection: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E8EAF0',
  },
  input: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#E8EAF0',
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  textArea: {
    height: 100,
    paddingTop: 16,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 13,
    marginTop: 6,
  },
  categoryScroll: {
    marginTop: 8,
  },
  categoryScrollContent: {
    gap: 10,
    paddingRight: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1A1F2E',
    borderWidth: 1,
    borderColor: '#2A2F3E',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChipSelected: {
    borderColor: 'transparent',
    padding: 0,
  },
  categoryChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryChipText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 20,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  cameraHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  cameraButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFooter: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successGradient: {
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    width: '100%',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.9,
  },
});
