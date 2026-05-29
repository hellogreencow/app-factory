import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useFireFight } from '../context/FireFightContext';

const { width, height } = Dimensions.get('window');

const STATUS_COLORS = {
  available: '#4CAF50',
  'on-duty': '#2196F3',
  'off-duty': '#757575',
  emergency: '#FF0000',
};

const STATUS_GRADIENTS = {
  available: ['#4CAF50', '#45a049'],
  'on-duty': ['#2196F3', '#1976D2'],
  'off-duty': ['#757575', '#616161'],
  emergency: ['#FF0000', '#cc0000'],
};

const STATUS_ICONS = {
  available: 'checkmark-circle',
  'on-duty': 'radio-button-on',
  'off-duty': 'moon',
  emergency: 'alert-circle',
};

const SEVERITY_COLORS = {
  low: '#4CAF50',
  medium: '#FFA500',
  high: '#FF6B00',
  critical: '#FF0000',
};

const SEVERITY_GRADIENTS = {
  low: ['#4CAF50', '#45a049'],
  medium: ['#FFA500', '#ff8c00'],
  high: ['#FF6B00', '#ff5500'],
  critical: ['#FF0000', '#cc0000'],
};

export default function TeamDetail({ route, navigation }) {
  const { id } = route?.params ?? {};
  const { team, incidents } = useFireFight();

  const [member, setMember] = useState(null);
  const [currentIncident, setCurrentIncident] = useState(null);
  const [incidentHistory, setIncidentHistory] = useState([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const mapRef = useRef(null);

  useEffect(() => {
    if (!id) {
      Alert.alert('Error', 'Team member not found', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    const foundMember = (team || []).find(m => m?.id === id);
    if (foundMember) {
      setMember(foundMember);
    } else {
      Alert.alert('Error', 'Team member not found', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [id, team]);

  useEffect(() => {
    if (member && incidents) {
      const allIncidents = incidents || [];
      
      const current = allIncidents.find(incident => {
        const assignedTeam = incident?.assignedTeam || [];
        return assignedTeam.includes(member.id) && incident?.status === 'active';
      });
      setCurrentIncident(current || null);

      const history = allIncidents
        .filter(incident => {
          const assignedTeam = incident?.assignedTeam || [];
          return assignedTeam.includes(member.id) && incident?.status !== 'active';
        })
        .sort((a, b) => {
          const timeA = a?.updatedAt || a?.createdAt || 0;
          const timeB = b?.updatedAt || b?.createdAt || 0;
          return timeB - timeA;
        })
        .slice(0, 10);
      
      setIncidentHistory(history);
    }
  }, [member, incidents]);

  useEffect(() => {
    if (member && member.latitude && member.longitude && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: member.latitude,
        longitude: member.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, [member]);

  const handleCall = () => {
    if (!member?.contact) {
      Alert.alert('Error', 'No contact information available');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const phoneNumber = member.contact.replace(/[^0-9]/g, '');
    const url = Platform.OS === 'ios' ? `telprompt:${phoneNumber}` : `tel:${phoneNumber}`;

    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot make phone calls on this device');
        }
      })
      .catch(err => {
        console.error('Error opening phone app:', err);
        Alert.alert('Error', 'Failed to open phone app');
      });
  };

  const handleMessage = () => {
    if (!member?.contact) {
      Alert.alert('Error', 'No contact information available');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const phoneNumber = member.contact.replace(/[^0-9]/g, '');
    const url = Platform.OS === 'ios' ? `sms:${phoneNumber}` : `sms:${phoneNumber}`;

    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot send messages on this device');
        }
      })
      .catch(err => {
        console.error('Error opening messaging app:', err);
        Alert.alert('Error', 'Failed to open messaging app');
      });
  };

  const handleLocate = async () => {
    if (!member?.latitude || !member?.longitude) {
      Alert.alert('Error', 'Location not available for this team member');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoadingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to navigate');
        setIsLoadingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const url = Platform.OS === 'ios'
        ? `maps://app?saddr=${currentLocation.coords.latitude},${currentLocation.coords.longitude}&daddr=${member.latitude},${member.longitude}`
        : `google.navigation:q=${member.latitude},${member.longitude}`;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.coords.latitude},${currentLocation.coords.longitude}&destination=${member.latitude},${member.longitude}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error navigating to location:', error);
      Alert.alert('Error', 'Failed to open navigation');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleIncidentPress = (incident) => {
    if (!incident?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Incidents', {
      screen: 'IncidentDetail',
      params: { id: incident.id },
    });
  };

  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Unknown';
    try {
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown';
    }
  };

  const formatIncidentTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Unknown';
    try {
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown';
    }
  };

  if (!member) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4500" />
        <Text style={styles.loadingText}>Loading team member...</Text>
      </View>
    );
  }

  const statusGradient = STATUS_GRADIENTS[member.status] || STATUS_GRADIENTS['off-duty'];
  const statusIcon = STATUS_ICONS[member.status] || STATUS_ICONS['off-duty'];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={statusGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={48} color="#f5f5f5" />
              </View>
              <View style={styles.statusBadge}>
                <Ionicons name={statusIcon} size={20} color="#f5f5f5" />
              </View>
            </View>

            <Text style={styles.memberName} testID="member-name">
              {member.name || 'Unknown'}
            </Text>
            <Text style={styles.memberRole} testID="member-role">
              {member.role || 'Firefighter'}
            </Text>

            <View style={styles.statusContainer}>
              <View style={styles.statusPill}>
                <Ionicons name={statusIcon} size={16} color="#f5f5f5" />
                <Text style={styles.statusText} testID="member-status">
                  {member.status ? member.status.charAt(0).toUpperCase() + member.status.slice(1).replace('-', ' ') : 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={24} color="#ff4500" />
            <Text style={styles.sectionTitle}>Live Location</Text>
          </View>

          {member.latitude && member.longitude ? (
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: member.latitude,
                  longitude: member.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                testID="location-map"
              >
                <Marker
                  coordinate={{
                    latitude: member.latitude,
                    longitude: member.longitude,
                  }}
                  testID="member-marker"
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.markerDot, { backgroundColor: STATUS_COLORS[member.status] || '#757575' }]} />
                  </View>
                </Marker>
              </MapView>

              <View style={styles.lastUpdateContainer}>
                <Ionicons name="time-outline" size={16} color="#888888" />
                <Text style={styles.lastUpdateText} testID="last-update">
                  Updated {formatLastUpdate(member.lastUpdate)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noLocationContainer}>
              <Ionicons name="location-outline" size={48} color="#444444" />
              <Text style={styles.noLocationText}>Location not available</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="radio-button-on" size={24} color="#ff4500" />
            <Text style={styles.sectionTitle}>Current Assignment</Text>
          </View>

          {currentIncident ? (
            <TouchableOpacity
              style={styles.assignmentCard}
              onPress={() => handleIncidentPress(currentIncident)}
              activeOpacity={0.7}
              testID="current-assignment-card"
              accessibilityLabel={`Current assignment: ${currentIncident.title || 'Untitled'}`}
            >
              <LinearGradient
                colors={SEVERITY_GRADIENTS[currentIncident.severity] || SEVERITY_GRADIENTS.medium}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.assignmentGradient}
              >
                <View style={styles.assignmentContent}>
                  <View style={styles.assignmentHeader}>
                    <Text style={styles.assignmentTitle} numberOfLines={2}>
                      {currentIncident.title || 'Untitled Incident'}
                    </Text>
                    <Ionicons name="chevron-forward" size={24} color="#f5f5f5" />
                  </View>

                  <View style={styles.assignmentDetails}>
                    <View style={styles.assignmentDetail}>
                      <Ionicons name="location-outline" size={16} color="#f5f5f5" />
                      <Text style={styles.assignmentDetailText} numberOfLines={1}>
                        {currentIncident.address || 'Unknown location'}
                      </Text>
                    </View>

                    <View style={styles.assignmentDetail}>
                      <Ionicons name="time-outline" size={16} color="#f5f5f5" />
                      <Text style={styles.assignmentDetailText}>
                        {formatLastUpdate(currentIncident.createdAt)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.severityBadge}>
                    <Text style={styles.severityBadgeText}>
                      {currentIncident.severity ? currentIncident.severity.toUpperCase() : 'UNKNOWN'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.noAssignmentContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#4CAF50" />
              <Text style={styles.noAssignmentText}>No active assignment</Text>
              <Text style={styles.noAssignmentSubtext}>This team member is currently available</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={24} color="#ff4500" />
            <Text style={styles.sectionTitle}>Incident History</Text>
          </View>

          {incidentHistory.length > 0 ? (
            <View style={styles.timeline}>
              {incidentHistory.map((incident, index) => (
                <TouchableOpacity
                  key={incident?.id || index}
                  style={styles.timelineItem}
                  onPress={() => handleIncidentPress(incident)}
                  activeOpacity={0.7}
                  testID={`history-incident-${index}`}
                  accessibilityLabel={`Past incident: ${incident?.title || 'Untitled'}`}
                >
                  <View style={styles.timelineLine}>
                    <View style={[styles.timelineDot, { backgroundColor: SEVERITY_COLORS[incident?.severity] || '#888888' }]} />
                    {index < incidentHistory.length - 1 && <View style={styles.timelineConnector} />}
                  </View>

                  <View style={styles.timelineContent}>
                    <View style={styles.timelineCard}>
                      <View style={styles.timelineCardHeader}>
                        <Text style={styles.timelineTitle} numberOfLines={2}>
                          {incident?.title || 'Untitled Incident'}
                        </Text>
                        <View style={[styles.timelineSeverityBadge, { backgroundColor: SEVERITY_COLORS[incident?.severity] || '#888888' }]}>
                          <Text style={styles.timelineSeverityText}>
                            {incident?.severity ? incident.severity.charAt(0).toUpperCase() : 'U'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.timelineDetails}>
                        <View style={styles.timelineDetail}>
                          <Ionicons name="location-outline" size={14} color="#888888" />
                          <Text style={styles.timelineDetailText} numberOfLines={1}>
                            {incident?.address || 'Unknown location'}
                          </Text>
                        </View>

                        <View style={styles.timelineDetail}>
                          <Ionicons name="calendar-outline" size={14} color="#888888" />
                          <Text style={styles.timelineDetailText}>
                            {formatIncidentTime(incident?.updatedAt || incident?.createdAt)}
                          </Text>
                        </View>

                        <View style={styles.timelineDetail}>
                          <Ionicons 
                            name={incident?.status === 'resolved' ? 'checkmark-circle' : 'archive'} 
                            size={14} 
                            color={incident?.status === 'resolved' ? '#4CAF50' : '#888888'} 
                          />
                          <Text style={[styles.timelineDetailText, { color: incident?.status === 'resolved' ? '#4CAF50' : '#888888' }]}>
                            {incident?.status ? incident.status.charAt(0).toUpperCase() + incident.status.slice(1) : 'Unknown'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noHistoryContainer}>
              <Ionicons name="document-text-outline" size={48} color="#444444" />
              <Text style={styles.noHistoryText}>No incident history</Text>
              <Text style={styles.noHistorySubtext}>Past incidents will appear here</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.contactActionsContainer}>
        <TouchableOpacity
          style={styles.contactButton}
          onPress={handleCall}
          activeOpacity={0.7}
          testID="call-button"
          accessibilityLabel="Call team member"
        >
          <LinearGradient
            colors={['#4CAF50', '#45a049']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.contactButtonGradient}
          >
            <Ionicons name="call" size={24} color="#f5f5f5" />
            <Text style={styles.contactButtonText}>Call</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactButton}
          onPress={handleMessage}
          activeOpacity={0.7}
          testID="message-button"
          accessibilityLabel="Message team member"
        >
          <LinearGradient
            colors={['#2196F3', '#1976D2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.contactButtonGradient}
          >
            <Ionicons name="chatbubble" size={24} color="#f5f5f5" />
            <Text style={styles.contactButtonText}>Message</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactButton}
          onPress={handleLocate}
          activeOpacity={0.7}
          disabled={isLoadingLocation}
          testID="locate-button"
          accessibilityLabel="Navigate to team member location"
        >
          <LinearGradient
            colors={['#ff4500', '#ff6b00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.contactButtonGradient}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color="#f5f5f5" />
            ) : (
              <>
                <Ionicons name="navigate" size={24} color="#f5f5f5" />
                <Text style={styles.contactButtonText}>Locate</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#f5f5f5',
    fontSize: 16,
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f5f5f5',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f5f5f5',
  },
  memberName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f5f5f5',
    marginBottom: 4,
    textAlign: 'center',
  },
  memberRole: {
    fontSize: 16,
    color: 'rgba(245, 245, 245, 0.9)',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    color: '#f5f5f5',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f5f5f5',
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  map: {
    width: '100%',
    height: 200,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#f5f5f5',
  },
  lastUpdateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    gap: 6,
  },
  lastUpdateText: {
    color: '#888888',
    fontSize: 14,
  },
  noLocationContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  noLocationText: {
    color: '#888888',
    fontSize: 16,
    marginTop: 12,
  },
  assignmentCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  assignmentGradient: {
    padding: 16,
  },
  assignmentContent: {
    gap: 12,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignmentTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f5f5f5',
    marginRight: 8,
  },
  assignmentDetails: {
    gap: 8,
  },
  assignmentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignmentDetailText: {
    flex: 1,
    color: 'rgba(245, 245, 245, 0.9)',
    fontSize: 14,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  severityBadgeText: {
    color: '#f5f5f5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noAssignmentContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  noAssignmentText: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  noAssignmentSubtext: {
    color: '#888888',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineLine: {
    width: 40,
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#333333',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  timelineCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timelineTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f5f5',
    marginRight: 8,
  },
  timelineSeverityBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineSeverityText: {
    color: '#f5f5f5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timelineDetails: {
    gap: 6,
  },
  timelineDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineDetailText: {
    flex: 1,
    color: '#888888',
    fontSize: 13,
  },
  noHistoryContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  noHistoryText: {
    color: '#888888',
    fontSize: 16,
    marginTop: 12,
  },
  noHistorySubtext: {
    color: '#666666',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 100,
  },
  contactActionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  contactButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  contactButtonText: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '600',
  },
});
