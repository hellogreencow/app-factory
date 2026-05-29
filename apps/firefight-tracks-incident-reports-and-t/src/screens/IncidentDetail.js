import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import { useFireFight } from '../context/FireFightContext';

const { width, height } = Dimensions.get('window');

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

const STATUS_COLORS = {
  active: '#2196F3',
  resolved: '#4CAF50',
  archived: '#757575',
};

const TEAM_STATUS_COLORS = {
  available: '#4CAF50',
  'on-duty': '#2196F3',
  'off-duty': '#757575',
  emergency: '#FF0000',
};

const SEVERITY_ICONS = {
  low: 'alert-circle-outline',
  medium: 'warning-outline',
  high: 'flame-outline',
  critical: 'nuclear-outline',
};

export default function IncidentDetail({ route, navigation }) {
  const { id } = route?.params ?? {};
  const { incidents, team, updateIncident } = useFireFight();

  const [incident, setIncident] = useState(null);
  const [assignedMembers, setAssignedMembers] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const mapRef = useRef(null);

  useEffect(() => {
    if (!id) {
      Alert.alert('Error', 'Incident not found', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    const foundIncident = (incidents || []).find(i => i?.id === id);
    if (foundIncident) {
      setIncident(foundIncident);
    } else {
      Alert.alert('Error', 'Incident not found', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [id, incidents]);

  useEffect(() => {
    if (incident && team) {
      const assigned = (incident.assignedTeam || [])
        .map(teamId => (team || []).find(t => t?.id === teamId))
        .filter(Boolean);
      setAssignedMembers(assigned);
    }
  }, [incident, team]);

  const handleStatusUpdate = async (newStatus) => {
    if (!incident) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Update Status',
      `Change incident status to "${newStatus}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await updateIncident(incident.id, {
                status: newStatus,
                updatedAt: Date.now(),
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error updating status:', error);
              Alert.alert('Error', 'Failed to update incident status');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleAddImage = async () => {
    if (!incident) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera roll permission is needed to add images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newImage = result.assets[0].uri;
      const updatedImages = [...(incident.images || []), newImage];
      
      try {
        await updateIncident(incident.id, {
          images: updatedImages,
          updatedAt: Date.now(),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error('Error adding image:', error);
        Alert.alert('Error', 'Failed to add image');
      }
    }
  };

  const handleShareReport = async () => {
    if (!incident) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSharing(true);

    try {
      const createdDate = new Date(incident.createdAt || Date.now());
      const safeCreatedDate = isNaN(createdDate.getTime()) ? new Date() : createdDate;
      const formattedDate = format(safeCreatedDate, 'PPpp');

      const report = `
INCIDENT REPORT

Title: ${incident.title || 'Untitled'}
Severity: ${(incident.severity || 'unknown').toUpperCase()}
Status: ${(incident.status || 'unknown').toUpperCase()}
Reported: ${formattedDate}
Location: ${incident.address || 'Unknown location'}

Description:
${incident.description || 'Standing by for sitrep...'}

Assigned Team: ${(incident.assignedTeam || []).length} member(s)
Reported By: ${incident.reportedBy || 'Unknown'}

---
Generated by FireFight App
      `.trim();

      const result = await Share.share({
        message: report,
        title: `Incident Report: ${incident.title || 'Untitled'}`,
      });

      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      Alert.alert('Error', 'Failed to share incident report');
    } finally {
      setIsSharing(false);
    }
  };

  const handleNavigate = () => {
    if (!incident) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const lat = incident.latitude || 0;
    const lng = incident.longitude || 0;
    const label = encodeURIComponent(incident.title || 'Incident Location');
    const url = `https://maps.google.com/?q=${lat},${lng}&label=${label}`;

    Linking.openURL(url).catch(err => {
      console.error('Error opening maps:', err);
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  const handleContactMember = (member) => {
    if (!member) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      `Contact ${member.name || 'Team Member'}`,
      member.contact || 'No contact information available',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            if (member.contact) {
              Linking.openURL(`tel:${member.contact}`).catch(err => {
                console.error('Error making call:', err);
              });
            }
          },
        },
      ]
    );
  };

  const handleImagePress = (imageUri) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImage(imageUri);
  };

  const handleCloseImageModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImage(null);
  };

  if (!incident) {
    return (
      <View style={styles.loadingContainer} testID="incident-detail-loading">
        <ActivityIndicator size="large" color="#ff4500" />
        <Text style={styles.loadingText}>Loading incident...</Text>
      </View>
    );
  }

  const createdDate = new Date(incident.createdAt || Date.now());
  const safeCreatedDate = isNaN(createdDate.getTime()) ? new Date() : createdDate;
  const updatedDate = new Date(incident.updatedAt || Date.now());
  const safeUpdatedDate = isNaN(updatedDate.getTime()) ? new Date() : updatedDate;

  const severity = incident.severity || 'low';
  const status = incident.status || 'active';
  const images = incident.images || [];

  return (
    <View style={styles.container} testID="incident-detail-screen">
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={SEVERITY_GRADIENTS[severity] || SEVERITY_GRADIENTS.low}
          style={styles.header}
          testID="incident-header"
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <View style={styles.severityBadge}>
                <Ionicons
                  name={SEVERITY_ICONS[severity] || 'alert-circle-outline'}
                  size={24}
                  color="#fff"
                />
                <Text style={styles.severityText}>{severity.toUpperCase()}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.active }]}>
                <Text style={styles.statusText}>{status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.headerTitle}>{incident.title || 'Untitled Incident'}</Text>
            <View style={styles.headerMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.metaText}>
                  {formatDistanceToNow(safeCreatedDate, { addSuffix: true })}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={16} color="#fff" />
                <Text style={styles.metaText}>{incident.reportedBy || 'Unknown'}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {images.length > 0 && (
          <View style={styles.section} testID="image-gallery">
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={24} color="#ff4500" />
              <Text style={styles.sectionTitle}>Incident Photos</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageGallery}
              contentContainerStyle={styles.imageGalleryContent}
            >
              {images.map((imageUri, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleImagePress(imageUri)}
                  style={styles.imageContainer}
                  testID={`gallery-image-${index}`}
                  accessibilityLabel={`View incident photo ${index + 1}`}
                >
                  <Image source={{ uri: imageUri }} style={styles.galleryImage} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={handleAddImage}
                style={styles.addImageButton}
                testID="add-image-button"
                accessibilityLabel="Add photo to incident"
              >
                <Ionicons name="add-circle-outline" size={48} color="#ff4500" />
                <Text style={styles.addImageText}>Add Photo</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {images.length === 0 && (
          <View style={styles.section} testID="image-gallery-empty">
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={24} color="#ff4500" />
              <Text style={styles.sectionTitle}>Incident Photos</Text>
            </View>
            <TouchableOpacity
              onPress={handleAddImage}
              style={styles.emptyImageState}
              testID="add-first-image-button"
              accessibilityLabel="Add first photo to incident"
            >
              <Ionicons name="camera-outline" size={64} color="#666" />
              <Text style={styles.emptyStateText}>No photos yet</Text>
              <Text style={styles.emptyStateSubtext}>Tap to add incident photos</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section} testID="location-preview">
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={24} color="#ff4500" />
            <Text style={styles.sectionTitle}>Location</Text>
          </View>
          <View style={styles.locationCard}>
            <MapView
              ref={mapRef}
              style={styles.mapPreview}
              initialRegion={{
                latitude: incident.latitude || 34.0522,
                longitude: incident.longitude || -118.2437,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              testID="location-map-preview"
            >
              <Marker
                coordinate={{
                  latitude: incident.latitude || 34.0522,
                  longitude: incident.longitude || -118.2437,
                }}
                pinColor={SEVERITY_COLORS[severity] || SEVERITY_COLORS.low}
              >
                <View style={[styles.customMarker, { backgroundColor: SEVERITY_COLORS[severity] || SEVERITY_COLORS.low }]}>
                  <Ionicons name="flame" size={20} color="#fff" />
                </View>
              </Marker>
            </MapView>
            <View style={styles.addressContainer}>
              <Text style={styles.addressText}>{incident.address || 'Unknown location'}</Text>
              <TouchableOpacity
                onPress={handleNavigate}
                style={styles.navigateButton}
                testID="navigate-button"
                accessibilityLabel="Navigate to incident location"
              >
                <Ionicons name="navigate-outline" size={20} color="#fff" />
                <Text style={styles.navigateButtonText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section} testID="incident-description">
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={24} color="#ff4500" />
            <Text style={styles.sectionTitle}>Description</Text>
          </View>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>
              {incident.description || 'No description provided'}
            </Text>
          </View>
        </View>

        <View style={styles.section} testID="team-assignment">
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={24} color="#ff4500" />
            <Text style={styles.sectionTitle}>Assigned Team</Text>
            <View style={styles.teamCountBadge}>
              <Text style={styles.teamCountText}>{assignedMembers.length}</Text>
            </View>
          </View>
          {assignedMembers.length > 0 ? (
            <View style={styles.teamList}>
              {assignedMembers.map((member, index) => {
                const memberStatus = member?.status || 'off-duty';
                const lastUpdateDate = new Date(member?.lastUpdate || Date.now());
                const safeLastUpdate = isNaN(lastUpdateDate.getTime()) ? new Date() : lastUpdateDate;

                return (
                  <TouchableOpacity
                    key={member?.id || index}
                    onPress={() => handleContactMember(member)}
                    style={styles.teamMemberCard}
                    testID={`team-member-${index}`}
                    accessibilityLabel={`Contact ${member?.name || 'team member'}`}
                  >
                    <View style={styles.teamMemberLeft}>
                      <View style={styles.avatarContainer}>
                        <LinearGradient
                          colors={['#ff4500', '#ffa500']}
                          style={styles.avatar}
                        >
                          <Text style={styles.avatarText}>
                            {(member?.name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </LinearGradient>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: TEAM_STATUS_COLORS[memberStatus] || TEAM_STATUS_COLORS['off-duty'] },
                          ]}
                        />
                      </View>
                      <View style={styles.teamMemberInfo}>
                        <Text style={styles.teamMemberName}>{member?.name || 'Unknown'}</Text>
                        <Text style={styles.teamMemberRole}>{member?.role || 'Firefighter'}</Text>
                        <Text style={styles.teamMemberStatus}>
                          {memberStatus} • {formatDistanceToNow(safeLastUpdate, { addSuffix: true })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.teamMemberActions}>
                      <TouchableOpacity
                        onPress={() => handleContactMember(member)}
                        style={styles.contactIconButton}
                        testID={`contact-member-${index}`}
                        accessibilityLabel={`Call ${member?.name || 'team member'}`}
                      >
                        <Ionicons name="call-outline" size={20} color="#ff4500" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyTeamState}>
              <Ionicons name="people-outline" size={64} color="#666" />
              <Text style={styles.emptyStateText}>No team assigned</Text>
              <Text style={styles.emptyStateSubtext}>Assign team members to this incident</Text>
            </View>
          )}
        </View>

        <View style={styles.section} testID="incident-timeline">
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={24} color="#ff4500" />
            <Text style={styles.sectionTitle}>Timeline</Text>
          </View>
          <View style={styles.timelineCard}>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Last Updated</Text>
                <Text style={styles.timelineValue}>
                  {format(safeUpdatedDate, 'PPpp')}
                </Text>
              </View>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Reported</Text>
                <Text style={styles.timelineValue}>
                  {format(safeCreatedDate, 'PPpp')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.actionBar} testID="status-update">
        <TouchableOpacity
          onPress={handleShareReport}
          style={styles.shareButton}
          disabled={isSharing}
          testID="share-report-button"
          accessibilityLabel="Share incident report"
        >
          {isSharing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Share</Text>
            </>
          )}
        </TouchableOpacity>

        {status === 'active' && (
          <TouchableOpacity
            onPress={() => handleStatusUpdate('resolved')}
            style={styles.resolveButton}
            disabled={isUpdating}
            testID="resolve-button"
            accessibilityLabel="Mark incident as resolved"
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.resolveButtonText}>Resolve</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {status === 'resolved' && (
          <TouchableOpacity
            onPress={() => handleStatusUpdate('archived')}
            style={styles.archiveButton}
            disabled={isUpdating}
            testID="archive-button"
            accessibilityLabel="Archive incident"
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="archive-outline" size={20} color="#fff" />
                <Text style={styles.archiveButtonText}>Archive</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {status === 'archived' && (
          <TouchableOpacity
            onPress={() => handleStatusUpdate('active')}
            style={styles.reactivateButton}
            disabled={isUpdating}
            testID="reactivate-button"
            accessibilityLabel="Reactivate incident"
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={20} color="#fff" />
                <Text style={styles.reactivateButtonText}>Reactivate</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseImageModal}
        testID="image-zoom-modal"
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={handleCloseImageModal}
            testID="close-image-modal"
            accessibilityLabel="Close image viewer"
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    gap: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  severityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
  },
  headerMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#f5f5f5',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  teamCountBadge: {
    backgroundColor: '#ff4500',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageGallery: {
    marginHorizontal: -20,
  },
  imageGalleryContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  imageContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  addImageButton: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#ff4500',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addImageText: {
    color: '#ff4500',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyImageState: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 14,
  },
  locationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapPreview: {
    width: '100%',
    height: 200,
  },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  addressContainer: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  addressText: {
    color: '#f5f5f5',
    fontSize: 16,
    flex: 1,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4500',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  descriptionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  descriptionText: {
    color: '#f5f5f5',
    fontSize: 16,
    lineHeight: 24,
  },
  teamList: {
    gap: 12,
  },
  teamMemberCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamMemberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  teamMemberInfo: {
    flex: 1,
    gap: 2,
  },
  teamMemberName: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '600',
  },
  teamMemberRole: {
    color: '#ffa500',
    fontSize: 14,
  },
  teamMemberStatus: {
    color: '#888',
    fontSize: 12,
  },
  teamMemberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contactIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTeamState: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  timelineCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff4500',
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    height: 24,
    backgroundColor: '#333',
    marginLeft: 5,
    marginVertical: 8,
  },
  timelineContent: {
    flex: 1,
    gap: 4,
  },
  timelineLabel: {
    color: '#888',
    fontSize: 14,
  },
  timelineValue: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '600',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 12,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resolveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  resolveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  archiveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#757575',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  archiveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reactivateButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  reactivateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  modalImage: {
    width: width,
    height: height * 0.8,
  },
});
