
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useFireFight } from '../context/FireFightContext';

const SEVERITY_COLORS = {
  critical: '#ff0000',
  high: '#ff6600',
  medium: '#ffaa00',
  low: '#00cc00',
};

const STATUS_COLORS = {
  active: '#ff4500',
  pending: '#ffaa00',
  resolved: '#00cc00',
};

export default function IncidentMap() {
  const navigation = useNavigation();
  const { incidents, teamMembers, theme } = useFireFight();
  const mapRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    showIncidents: true,
    showTeam: true,
    severities: {
      critical: true,
      high: true,
      medium: true,
      low: true,
    },
    statuses: {
      active: true,
      pending: true,
      resolved: false,
    },
  });

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');

      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } else {
        // Default to San Francisco if permission denied
        setUserLocation({
          latitude: 37.7749,
          longitude: -122.4194,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      // Default location
      setUserLocation({
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const centerOnUser = async () => {
    if (!locationPermission) {
      Alert.alert(
        'Location Permission Required',
        'Please enable location permissions to use this feature.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setUserLocation(region);
      mapRef.current?.animateToRegion(region, 1000);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get current location');
    }
  };

  const filteredIncidents = incidents.filter((incident) => {
    if (!filters.showIncidents) return false;
    if (!filters.severities[incident.severity]) return false;
    if (!filters.statuses[incident.status]) return false;
    return incident.location && incident.location.latitude && incident.location.longitude;
  });

  const filteredTeamMembers = teamMembers.filter((member) => {
    if (!filters.showTeam) return false;
    return member.location && member.location.latitude && member.location.longitude;
  });

  const toggleFilter = (category, key) => {
    setFilters((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key],
      },
    }));
  };

  const toggleMainFilter = (key) => {
    setFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (isLoadingLocation) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#0a0a0a' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff4500" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="incident-map-screen">
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={userLocation}
        showsUserLocation={locationPermission}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        testID="map-view"
      >
        {/* Incident Markers */}
        {filteredIncidents.map((incident) => (
          <Marker
            key={`incident-${incident.id}`}
            coordinate={{
              latitude: incident.location.latitude,
              longitude: incident.location.longitude,
            }}
            pinColor={SEVERITY_COLORS[incident.severity]}
            onPress={() => setSelectedMarker({ type: 'incident', data: incident })}
            testID={`incident-marker-${incident.id}`}
          >
            <Callout
              onPress={() => {
                setSelectedMarker(null);
                navigation.navigate('Incidents', {
                  screen: 'IncidentDetail',
                  params: { incidentId: incident.id },
                });
              }}
            >
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{incident.title}</Text>
                <Text style={styles.calloutDescription} numberOfLines={2}>
                  {incident.description}
                </Text>
                <View style={styles.calloutFooter}>
                  <View
                    style={[
                      styles.severityBadge,
                      { backgroundColor: SEVERITY_COLORS[incident.severity] },
                    ]}
                  >
                    <Text style={styles.severityText}>
                      {incident.severity.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.calloutTap}>Tap for details →</Text>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Team Member Markers */}
        {filteredTeamMembers.map((member) => (
          <Marker
            key={`team-${member.id}`}
            coordinate={{
              latitude: member.location.latitude,
              longitude: member.location.longitude,
            }}
            onPress={() => setSelectedMarker({ type: 'team', data: member })}
            testID={`team-marker-${member.id}`}
          >
            <View style={styles.teamMarker}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
            <Callout
              onPress={() => {
                setSelectedMarker(null);
                navigation.navigate('Team', {
                  screen: 'TeamDetail',
                  params: { memberId: member.id },
                });
              }}
            >
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{member.name}</Text>
                <Text style={styles.calloutDescription}>{member.role}</Text>
                <View style={styles.calloutFooter}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          member.status === 'available'
                            ? '#00cc00'
                            : member.status === 'busy'
                            ? '#ff6600'
                            : '#888888',
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {member.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.calloutTap}>Tap for details →</Text>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Top Controls */}
      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
          testID="filter-button"
          accessibilityLabel="Open filters"
        >
          <Ionicons name="filter" size={24} color="#fff" />
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={centerOnUser}
          testID="center-location-button"
          accessibilityLabel="Center on my location"
        >
          <Ionicons name="locate" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('Incidents', { screen: 'AddIncident' })}
          testID="add-incident-button"
          accessibilityLabel="Add new incident"
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Map Filters</Text>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                testID="close-filters-button"
                accessibilityLabel="Close filters"
              >
                <Ionicons name="close" size={28} color="#f5f5f5" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterContent}>
              {/* Main Filters */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Show On Map</Text>
                <TouchableOpacity
                  style={styles.filterItem}
                  onPress={() => toggleMainFilter('showIncidents')}
                  testID="toggle-incidents-filter"
                >
                  <Text style={styles.filterItemText}>Incidents</Text>
                  <View
                    style={[
                      styles.checkbox,
                      filters.showIncidents && styles.checkboxChecked,
                    ]}
                  >
                    {filters.showIncidents && (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterItem}
                  onPress={() => toggleMainFilter('showTeam')}
                  testID="toggle-team-filter"
                >
                  <Text style={styles.filterItemText}>Team Members</Text>
                  <View
                    style={[
                      styles.checkbox,
                      filters.showTeam && styles.checkboxChecked,
                    ]}
                  >
                    {filters.showTeam && (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Severity Filters */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Incident Severity</Text>
                {Object.keys(filters.severities).map((severity) => (
                  <TouchableOpacity
                    key={severity}
                    style={styles.filterItem}
                    onPress={() => toggleFilter('severities', severity)}
                    testID={`toggle-severity-${severity}`}
                  >
                    <View style={styles.filterItemLeft}>
                      <View
                        style={[
                          styles.severityDot,
                          { backgroundColor: SEVERITY_COLORS[severity] },
                        ]}
                      />
                      <Text style={styles.filterItemText}>
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        filters.severities[severity] && styles.checkboxChecked,
                      ]}
                    >
                      {filters.severities[severity] && (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Status Filters */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Incident Status</Text>
                {Object.keys(filters.statuses).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={styles.filterItem}
                    onPress={() => toggleFilter('statuses', status)}
                    testID={`toggle-status-${status}`}
                  >
                    <View style={styles.filterItemLeft}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: STATUS_COLORS[status] },
                        ]}
                      />
                      <Text style={styles.filterItemText}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        filters.statuses[status] && styles.checkboxChecked,
                      ]}
                    >
                      {filters.statuses[status] && (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    alignItems: 'flex-end',
  },
  locationButton: {
    backgroundColor: '#1a1a1a',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  addButton: {
    backgroundColor: '#ff4500',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  teamMarker: {
    backgroundColor: '#3b82f6',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  calloutContainer: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  calloutFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  calloutTap: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f5f5f5',
  },
  filterContent: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 12,
  },
  filterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  filterItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterItemText: {
    fontSize: 16,
    color: '#f5f5f5',
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#ff4500',
    borderColor: '#ff4500',
  },
});
