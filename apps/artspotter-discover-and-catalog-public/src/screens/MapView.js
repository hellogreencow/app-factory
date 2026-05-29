import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useArtSpotter } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'Mural', label: 'Murals', icon: 'color-palette' },
  { id: 'Sculpture', label: 'Sculptures', icon: 'cube' },
  { id: 'Installation', label: 'Installations', icon: 'bulb' },
  { id: 'Street Art', label: 'Street Art', icon: 'brush' },
];

export default function MapViewScreen({ navigation }) {
  const { installations, toggleSaveArt, savedArt } = useArtSpotter();
  const mapRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [region, setRegion] = useState({
    latitude: 40.7580,
    longitude: -73.9855,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const filterChipScale = useSharedValue(1);
  const locationButtonScale = useSharedValue(1);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        getCurrentLocation();
      } else {
        Alert.alert(
          'Location Permission',
          'Location permission is needed to show nearby art installations.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error('Location permission error:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          },
          1000
        );
      }
    } catch (error) {
      console.error('Get location error:', error);
    }
  };

  const handleCenterOnUser = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    locationButtonScale.value = withSpring(0.9, {}, () => {
      locationButtonScale.value = withSpring(1);
    });
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...userLocation,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        },
        1000
      );
    } else if (!locationPermission) {
      requestLocationPermission();
    }
  };

  const handleCategorySelect = (categoryId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(categoryId);
    filterChipScale.value = withSpring(0.95, {}, () => {
      filterChipScale.value = withSpring(1);
    });
  };

  const filteredInstallations = (installations || []).filter((art) => {
    const matchesCategory =
      selectedCategory === 'all' || art?.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      art?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art?.artist?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleMarkerPress = (art) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMarker(art);
    if (mapRef.current && art?.latitude && art?.longitude) {
      mapRef.current.animateToRegion(
        {
          latitude: art.latitude,
          longitude: art.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
    }
  };

  const handleGetDirections = (art) => {
    if (!art?.latitude || !art?.longitude) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q=',
    });
    const latLng = `${art.latitude},${art.longitude}`;
    const label = art?.title || 'Art Installation';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    Linking.openURL(url);
  };

  const handleSaveArt = (artId) => {
    if (!artId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (typeof toggleSaveArt === 'function') {
      toggleSaveArt(artId);
    }
  };

  const isArtSaved = (artId) => {
    if (!artId || !Array.isArray(savedArt)) return false;
    return savedArt.includes(artId);
  };

  const locationButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: locationButtonScale.value }],
    };
  });

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation={locationPermission}
        showsMyLocationButton={false}
        showsCompass={true}
        testID="map-view"
        accessibilityLabel="Interactive map showing art installations"
      >
        {(filteredInstallations || []).map((art) => {
          if (!art?.id || !art?.latitude || !art?.longitude) return null;
          return (
            <Marker
              key={art.id}
              coordinate={{
                latitude: art.latitude,
                longitude: art.longitude,
              }}
              onPress={() => handleMarkerPress(art)}
              testID={`marker-${art.id}`}
              accessibilityLabel={`Art marker for ${art?.title || 'Unknown'}`}
            >
              <View style={styles.markerContainer}>
                <LinearGradient
                  colors={['#6C5CE7', '#A29BFE']}
                  style={styles.markerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={
                      art?.category === 'Mural'
                        ? 'color-palette'
                        : art?.category === 'Sculpture'
                        ? 'cube'
                        : art?.category === 'Installation'
                        ? 'bulb'
                        : 'brush'
                    }
                    size={20}
                    color="#FFFFFF"
                  />
                </LinearGradient>
              </View>
              <Callout
                tooltip
                onPress={() => {
                  if (art?.id) {
                    navigation?.navigate?.('ArtDetail', { artId: art.id });
                  }
                }}
                testID={`callout-${art.id}`}
              >
                <View style={styles.calloutContainer}>
                  {art?.imageUri ? (
                    <Image
                      source={{ uri: art.imageUri }}
                      style={styles.calloutImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.calloutContent}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>
                      {art?.title || 'Untitled'}
                    </Text>
                    <Text style={styles.calloutArtist} numberOfLines={1}>
                      by {art?.artist || 'Unknown Artist'}
                    </Text>
                    <View style={styles.calloutStats}>
                      <View style={styles.calloutStat}>
                        <Ionicons name="heart" size={14} color="#FD79A8" />
                        <Text style={styles.calloutStatText}>
                          {art?.likes || 0}
                        </Text>
                      </View>
                      <View style={styles.calloutStat}>
                        <Ionicons name="eye" size={14} color="#6C5CE7" />
                        <Text style={styles.calloutStatText}>
                          {art?.visits || 0}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.calloutActions}>
                      <TouchableOpacity
                        style={styles.calloutButton}
                        onPress={() => handleSaveArt(art.id)}
                        testID={`callout-save-${art.id}`}
                        accessibilityLabel={`Save ${art?.title || 'art'}`}
                      >
                        <Ionicons
                          name={isArtSaved(art.id) ? 'bookmark' : 'bookmark-outline'}
                          size={18}
                          color="#6C5CE7"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.calloutButton}
                        onPress={() => handleGetDirections(art)}
                        testID={`callout-directions-${art.id}`}
                        accessibilityLabel={`Get directions to ${art?.title || 'art'}`}
                      >
                        <Ionicons name="navigate" size={18} color="#6C5CE7" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.topOverlay}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#8B8FA3"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search art or artist..."
            placeholderTextColor="#8B8FA3"
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="search-input"
            accessibilityLabel="Search for art installations"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              testID="search-clear"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color="#8B8FA3" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive,
                ]}
                onPress={() => handleCategorySelect(category.id)}
                testID={`filter-${category.id}`}
                accessibilityLabel={`Filter by ${category.label}`}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={['#6C5CE7', '#A29BFE']}
                    style={styles.filterChipGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons
                      name={category.icon}
                      size={16}
                      color="#FFFFFF"
                      style={styles.filterIcon}
                    />
                    <Text style={styles.filterChipTextActive}>
                      {category.label}
                    </Text>
                  </LinearGradient>
                ) : (
                  <>
                    <Ionicons
                      name={category.icon}
                      size={16}
                      color="#8B8FA3"
                      style={styles.filterIcon}
                    />
                    <Text style={styles.filterChipText}>{category.label}</Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Animated.View style={[styles.locationButton, locationButtonAnimatedStyle]}>
        <TouchableOpacity
          style={styles.locationButtonInner}
          onPress={handleCenterOnUser}
          testID="location-button"
          accessibilityLabel="Center map on current location"
        >
          <LinearGradient
            colors={['#6C5CE7', '#A29BFE']}
            style={styles.locationButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="locate" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {filteredInstallations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateCard}>
            <Ionicons name="map-outline" size={48} color="#6C5CE7" />
            <Text style={styles.emptyStateTitle}>No Art Found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery
                ? "Try a different search term"
                : "No art installations in this category"}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  map: {
    width: width,
    height: height,
  },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#E8EAF0',
    fontWeight: '500',
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterScrollContent: {
    paddingRight: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  filterChipActive: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  filterChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterIcon: {
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B8FA3',
  },
  filterChipTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    zIndex: 10,
  },
  locationButtonInner: {
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  locationButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  calloutContainer: {
    width: 240,
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  calloutImage: {
    width: '100%',
    height: 120,
  },
  calloutContent: {
    padding: 12,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E8EAF0',
    marginBottom: 4,
  },
  calloutArtist: {
    fontSize: 14,
    color: '#8B8FA3',
    marginBottom: 8,
  },
  calloutStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  calloutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  calloutStatText: {
    fontSize: 12,
    color: '#8B8FA3',
    marginLeft: 4,
    fontWeight: '600',
  },
  calloutActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#2A2F3E',
    paddingTop: 12,
  },
  calloutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0A0E1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    zIndex: 5,
  },
  emptyStateCard: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E8EAF0',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8B8FA3',
    textAlign: 'center',
  },
});
