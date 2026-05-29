import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Alert,
  Platform,
  Linking,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { formatDistanceToNow, format } from 'date-fns';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';
import { useArtSpotter } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

export default function ArtDetail({ route, navigation }) {
  const { installations, savedArt, toggleSaveArt } = useArtSpotter();
  const { id } = route?.params ?? {};

  const [art, setArt] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [sharing, setSharing] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const heartScale = useSharedValue(1);
  const shareScale = useSharedValue(1);
  const scale = useSharedValue(1);
  const lastScale = useSharedValue(1);

  useEffect(() => {
    if (!id) {
      Alert.alert("Error", "Art installation not found");
      navigation.goBack();
      return;
    }

    const foundArt = (installations || []).find((item) => item?.id === id);
    if (foundArt) {
      setArt(foundArt);
      setIsSaved((savedArt || []).includes(id));
    } else {
      Alert.alert("Error", "Art installation not found");
      navigation.goBack();
    }
  }, [id, installations, savedArt, navigation]);

  const handleSaveToggle = useCallback(() => {
    if (!art?.id) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    heartScale.value = withSequence(
      withSpring(1.3, { damping: 5 }),
      withSpring(1.0)
    );

    toggleSaveArt?.(art.id);
    setIsSaved((prev) => !prev);

    if (!isSaved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [art, isSaved, toggleSaveArt]);

  const handleShare = useCallback(async () => {
    if (!art) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    shareScale.value = withSequence(
      withSpring(0.9),
      withSpring(1.0)
    );

    setSharing(true);

    try {
      const message = `Check out "${art?.title ?? 'this art'}" by ${art?.artist ?? 'Unknown Artist'} on ArtSpotter!\n\n${art?.description ?? ''}`;

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Share.share({
          message,
          title: art?.title ?? 'Art Installation',
        });
      } else {
        await Clipboard.setStringAsync(message);
        Alert.alert("Copied", "Art details copied to clipboard!");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert("Error", "Could not share art details");
    } finally {
      setSharing(false);
    }
  }, [art]);

  const handleCopyLocation = useCallback(async () => {
    if (!art?.latitude || !art?.longitude) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const locationText = `${art.latitude}, ${art.longitude}`;
    await Clipboard.setStringAsync(locationText);
    
    Alert.alert("Copied", "Location coordinates copied to clipboard!");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [art]);

  const handleOpenNavigation = useCallback(() => {
    if (!art?.latitude || !art?.longitude) {
      Alert.alert("Error", "Location not available");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const latitude = art.latitude;
    const longitude = art.longitude;
    const label = art?.title ?? 'Art Installation';

    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q=',
    });
    const latLng = `${latitude},${longitude}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Could not open maps application");
    });
  }, [art]);

  const onPinchEvent = useCallback((event) => {
    scale.value = lastScale.value * event.nativeEvent.scale;
  }, []);

  const onPinchStateChange = useCallback((event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastScale.value = scale.value;
      
      if (scale.value < 1) {
        scale.value = withSpring(1);
        lastScale.value = 1;
      } else if (scale.value > 3) {
        scale.value = withSpring(3);
        lastScale.value = 3;
      }
    }
  }, []);

  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const heartAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: heartScale.value }],
    };
  });

  const shareAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: shareScale.value }],
    };
  });

  if (!art) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading art details...</Text>
      </View>
    );
  }

  const dateAdded = art?.dateAdded ? new Date(art.dateAdded) : new Date();
  const safeDateAdded = isNaN(dateAdded.getTime()) ? new Date() : dateAdded;
  const relativeDate = formatDistanceToNow(safeDateAdded, { addSuffix: true });
  const formattedDate = format(safeDateAdded, 'MMM d, yyyy');

  const hasLocation = typeof art?.latitude === 'number' && typeof art?.longitude === 'number';

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="art-detail-scroll"
      >
        <PinchGestureHandler
          onGestureEvent={onPinchEvent}
          onHandlerStateChange={onPinchStateChange}
        >
          <Animated.View style={styles.imageContainer}>
            <Animated.Image
              source={{ uri: art?.imageUri ?? 'https://via.placeholder.com/800' }}
              style={[styles.heroImage, animatedImageStyle]}
              resizeMode="cover"
              testID="art-detail-image"
            />
            <LinearGradient
              colors={['transparent', 'rgba(10, 14, 26, 0.8)']}
              style={styles.imageGradient}
              pointerEvents="none"
            />
          </Animated.View>
        </PinchGestureHandler>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          testID="back-button"
          accessibilityLabel="Go back"
        >
          <LinearGradient
            colors={['rgba(26, 31, 46, 0.9)', 'rgba(26, 31, 46, 0.7)']}
            style={styles.backButtonGradient}
          >
            <Ionicons name="arrow-back" size={24} color="#E8EAF0" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <Animated.View style={heartAnimatedStyle}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSaveToggle}
              testID="save-toggle-button"
              accessibilityLabel={isSaved ? "Unsave art" : "Save art"}
            >
              <LinearGradient
                colors={isSaved ? ['#6C5CE7', '#5B4BC7'] : ['rgba(26, 31, 46, 0.9)', 'rgba(26, 31, 46, 0.7)']}
                style={styles.actionButtonGradient}
              >
                <Ionicons 
                  name={isSaved ? "heart" : "heart-outline"} 
                  size={24} 
                  color={isSaved ? "#FFF" : "#E8EAF0"} 
                />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={shareAnimatedStyle}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleShare}
              disabled={sharing}
              testID="share-button"
              accessibilityLabel="Share art"
            >
              <LinearGradient
                colors={['rgba(26, 31, 46, 0.9)', 'rgba(26, 31, 46, 0.7)']}
                style={styles.actionButtonGradient}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color="#E8EAF0" />
                ) : (
                  <Ionicons name="share-outline" size={24} color="#E8EAF0" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerSection}>
            <View style={styles.categoryBadge}>
              <Ionicons 
                name={
                  art?.category === 'Mural' ? 'color-palette' :
                  art?.category === 'Sculpture' ? 'cube' :
                  art?.category === 'Installation' ? 'bulb' :
                  art?.category === 'Street Art' ? 'brush' :
                  'image'
                } 
                size={14} 
                color="#6C5CE7" 
              />
              <Text style={styles.categoryText}>{art?.category ?? 'Art'}</Text>
            </View>

            <Text style={styles.title} testID="art-title">
              {art?.title ?? 'Untitled'}
            </Text>

            <View style={styles.artistRow}>
              <Ionicons name="person-outline" size={18} color="#8B8FA3" />
              <Text style={styles.artist} testID="art-artist">
                {art?.artist ?? 'Unknown Artist'}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={20} color="#FD79A8" />
              <Text style={styles.statValue}>{art?.likes ?? 0}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Ionicons name="eye" size={20} color="#6C5CE7" />
              <Text style={styles.statValue}>{art?.visits ?? 0}</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Ionicons name="calendar-outline" size={20} color="#8B8FA3" />
              <Text style={styles.statValue}>{formattedDate}</Text>
              <Text style={styles.statLabel}>{relativeDate}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color="#6C5CE7" />
              <Text style={styles.sectionTitle}>Description</Text>
            </View>
            <Text style={styles.description} testID="art-description">
              {art?.description ?? 'No description available.'}
            </Text>
          </View>

          {hasLocation && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location-outline" size={20} color="#6C5CE7" />
                <Text style={styles.sectionTitle}>Location</Text>
              </View>

              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: art.latitude,
                    longitude: art.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  onMapReady={() => setMapReady(true)}
                  testID="art-location-map"
                >
                  <Marker
                    coordinate={{
                      latitude: art.latitude,
                      longitude: art.longitude,
                    }}
                    title={art?.title ?? 'Art Location'}
                  >
                    <View style={styles.customMarker}>
                      <Ionicons name="location" size={32} color="#6C5CE7" />
                    </View>
                  </Marker>
                </MapView>

                <TouchableOpacity
                  style={styles.mapOverlay}
                  onPress={handleOpenNavigation}
                  testID="open-navigation-button"
                  accessibilityLabel="Open in maps"
                >
                  <LinearGradient
                    colors={['rgba(10, 14, 26, 0.7)', 'rgba(10, 14, 26, 0.9)']}
                    style={styles.mapOverlayGradient}
                  >
                    <Ionicons name="navigate" size={24} color="#6C5CE7" />
                    <Text style={styles.mapOverlayText}>Open in Maps</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={styles.locationDetails}>
                <View style={styles.locationRow}>
                  <Ionicons name="compass-outline" size={16} color="#8B8FA3" />
                  <Text style={styles.locationText}>
                    {art.latitude.toFixed(6)}, {art.longitude.toFixed(6)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCopyLocation}
                  testID="copy-location-button"
                  accessibilityLabel="Copy location coordinates"
                >
                  <Ionicons name="copy-outline" size={18} color="#6C5CE7" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleOpenNavigation}
              disabled={!hasLocation}
              testID="navigate-button"
              accessibilityLabel="Navigate to art location"
            >
              <LinearGradient
                colors={hasLocation ? ['#6C5CE7', '#5B4BC7'] : ['#3A3F4E', '#2A2F3E']}
                style={styles.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons 
                  name="navigate" 
                  size={20} 
                  color={hasLocation ? "#FFF" : "#5A5F6E"} 
                />
                <Text style={[
                  styles.primaryButtonText,
                  !hasLocation && styles.primaryButtonTextDisabled
                ]}>
                  Get Directions
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleShare}
              disabled={sharing}
              testID="share-details-button"
              accessibilityLabel="Share art details"
            >
              <View style={styles.secondaryButtonContent}>
                {sharing ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <>
                    <Ionicons name="share-social-outline" size={20} color="#6C5CE7" />
                    <Text style={styles.secondaryButtonText}>Share Details</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8B8FA3',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    width: width,
    height: height * 0.5,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    zIndex: 10,
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 234, 240, 0.1)',
  },
  actionButtons: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    zIndex: 10,
  },
  actionButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 234, 240, 0.1)',
  },
  contentContainer: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  headerSection: {
    marginBottom: 24,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.3)',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E8EAF0',
    marginBottom: 12,
    lineHeight: 38,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  artist: {
    fontSize: 18,
    fontWeight: '500',
    color: '#8B8FA3',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E8EAF0',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8B8FA3',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2A2F3E',
    marginHorizontal: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E8EAF0',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#B8BAC3',
    fontWeight: '400',
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1F2E',
    borderWidth: 1,
    borderColor: '#2A2F3E',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  mapOverlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  mapOverlayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E8EAF0',
  },
  locationDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    color: '#8B8FA3',
    fontWeight: '500',
  },
  actionSection: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  primaryButtonTextDisabled: {
    color: '#5A5F6E',
  },
  secondaryButton: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6C5CE7',
    overflow: 'hidden',
  },
  secondaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6C5CE7',
  },
  bottomSpacer: {
    height: 20,
  },
});
