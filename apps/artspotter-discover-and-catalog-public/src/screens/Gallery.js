import React, { useState, useMemo, useCallback, useRef } from 'react';
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
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { formatDistanceToNow, format } from 'date-fns';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useArtSpotter } from '../context/AppContext';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const TABS = [
  { id: 'saved', label: 'Saved', icon: 'bookmark' },
  { id: 'visited', label: 'Visited', icon: 'checkmark-circle' },
];

export default function Gallery({ navigation }) {
  const { installations, savedArt, visitedArt, toggleSaveArt, addVisit, userStats } = useArtSpotter();

  const [activeTab, setActiveTab] = useState('saved');
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [selectedArt, setSelectedArt] = useState(null);
  const [visitNotes, setVisitNotes] = useState('');
  const [exporting, setExporting] = useState(false);

  const tabIndicatorPosition = useSharedValue(0);

  const savedInstallations = useMemo(() => {
    return (installations || []).filter((art) => 
      (savedArt || []).includes(art?.id)
    );
  }, [installations, savedArt]);

  const visitedInstallations = useMemo(() => {
    const visitedIds = (visitedArt || []).map((v) => v?.artId).filter(Boolean);
    return (installations || []).filter((art) => 
      visitedIds.includes(art?.id)
    );
  }, [installations, visitedArt]);

  const displayedArt = activeTab === 'saved' ? savedInstallations : visitedInstallations;

  const stats = useMemo(() => {
    const totalSaved = (savedArt || []).length;
    const totalVisited = (visitedArt || []).length;
    const favoriteCount = (savedArt || []).length;

    return {
      saved: totalSaved,
      visited: totalVisited,
      favorites: favoriteCount,
    };
  }, [savedArt, visitedArt]);

  const handleTabChange = useCallback((tabId, index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tabId);
    tabIndicatorPosition.value = withSpring(index * (width / 2));
  }, []);

  const handleRemoveArt = useCallback((artId) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toggleSaveArt?.(artId);
  }, [toggleSaveArt]);

  const handleMarkVisited = useCallback((art) => {
    setSelectedArt(art);
    setVisitNotes('');
    setVisitModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleSaveVisit = useCallback(() => {
    if (!selectedArt?.id) return;

    const visitData = {
      artId: selectedArt.id,
      visitDate: new Date().toISOString(),
      notes: visitNotes.trim(),
    };

    addVisit?.(visitData);
    setVisitModalVisible(false);
    setSelectedArt(null);
    setVisitNotes('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedArt, visitNotes, addVisit]);

  const handleExportCollection = useCallback(async () => {
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const collectionData = {
        totalSaved: stats.saved,
        totalVisited: stats.visited,
        savedArt: savedInstallations.map((art) => ({
          title: art?.title || 'Untitled',
          artist: art?.artist || 'Unknown',
          category: art?.category || 'Unknown',
          dateAdded: art?.dateAdded || new Date().toISOString(),
        })),
        visitedArt: visitedInstallations.map((art) => {
          const visit = (visitedArt || []).find((v) => v?.artId === art?.id);
          return {
            title: art?.title || 'Untitled',
            artist: art?.artist || 'Unknown',
            visitDate: visit?.visitDate || new Date().toISOString(),
            notes: visit?.notes || '',
          };
        }),
        exportDate: new Date().toISOString(),
      };

      const fileName = `artspotter_collection_${Date.now()}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify(collectionData, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Share Your Art Collection',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Export Complete', `Collection saved to ${fileName}`);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Could not export collection. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setExporting(false);
    }
  }, [stats, savedInstallations, visitedInstallations, visitedArt]);

  const handleShareArt = useCallback(async (art) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const shareText = `Check out "${art?.title || 'this art'}" by ${art?.artist || 'Unknown Artist'} on ArtSpotter!`;

      if (art?.imageUri) {
        const fileUri = `${FileSystem.cacheDirectory}${art.id}_share.jpg`;
        const downloadResult = await FileSystem.downloadAsync(art.imageUri, fileUri);

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri, {
            dialogTitle: shareText,
          });
        }
      } else {
        Alert.alert('Share', shareText);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Failed', 'Could not share this art. Please try again.');
    }
  }, []);

  const renderRightActions = useCallback((art) => {
    return (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity
          style={[styles.swipeAction, styles.shareAction]}
          onPress={() => handleShareArt(art)}
          testID={`share-action-${art?.id}`}
          accessibilityLabel={`Share ${art?.title || 'art'}`}
        >
          <Ionicons name="share-outline" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, styles.deleteAction]}
          onPress={() => handleRemoveArt(art?.id)}
          testID={`delete-action-${art?.id}`}
          accessibilityLabel={`Remove ${art?.title || 'art'} from collection`}
        >
          <Ionicons name="trash-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  }, [handleShareArt, handleRemoveArt]);

  const renderArtCard = useCallback(({ item: art }) => {
    if (!art?.id) return null;

    const isVisited = (visitedArt || []).some((v) => v?.artId === art.id);
    const visit = (visitedArt || []).find((v) => v?.artId === art.id);

    const dateAdded = art?.dateAdded ? new Date(art.dateAdded) : new Date();
    const safeDateAdded = isNaN(dateAdded.getTime()) ? new Date() : dateAdded;

    return (
      <Swipeable
        renderRightActions={() => renderRightActions(art)}
        overshootRight={false}
        friction={2}
        testID={`swipeable-${art.id}`}
      >
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.artCard}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation?.navigate?.('ArtDetail', { artId: art.id })}
            testID={`art-card-${art.id}`}
            accessibilityLabel={`View details for ${art?.title || 'art'}`}
          >
            <View style={styles.imageContainer}>
              {art?.imageUri ? (
                <Image
                  source={{ uri: art.imageUri }}
                  style={styles.artImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.artImage, styles.placeholderImage]}>
                  <Ionicons name="image-outline" size={40} color="#4A4F5E" />
                </View>
              )}
              {isVisited && (
                <View style={styles.visitedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#00D9A5" />
                </View>
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.imageGradient}
              />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.artTitle} numberOfLines={1}>
                {art?.title || 'Untitled'}
              </Text>
              <Text style={styles.artArtist} numberOfLines={1}>
                {art?.artist || 'Unknown Artist'}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.categoryBadge}>
                  <Ionicons name="pricetag" size={12} color="#6C5CE7" />
                  <Text style={styles.categoryText}>
                    {art?.category || 'Art'}
                  </Text>
                </View>

                {activeTab === 'visited' && visit?.visitDate ? (
                  <Text style={styles.visitDate}>
                    {formatDistanceToNow(
                      isNaN(new Date(visit.visitDate).getTime()) 
                        ? new Date() 
                        : new Date(visit.visitDate),
                      { addSuffix: true }
                    )}
                  </Text>
                ) : (
                  <Text style={styles.dateText}>
                    {formatDistanceToNow(safeDateAdded, { addSuffix: true })}
                  </Text>
                )}
              </View>

              {activeTab === 'saved' && !isVisited && (
                <TouchableOpacity
                  style={styles.markVisitedButton}
                  onPress={() => handleMarkVisited(art)}
                  testID={`mark-visited-${art.id}`}
                  accessibilityLabel={`Mark ${art?.title || 'art'} as visited`}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#6C5CE7" />
                  <Text style={styles.markVisitedText}>Mark Visited</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Swipeable>
    );
  }, [activeTab, visitedArt, navigation, handleMarkVisited, renderRightActions]);

  const tabIndicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: tabIndicatorPosition.value }],
    };
  });

  const renderEmptyState = useCallback(() => {
    const isVisitedTab = activeTab === 'visited';
    return (
      <Animated.View
        entering={FadeIn.duration(400)}
        style={styles.emptyContainer}
      >
        <View style={styles.emptyIconContainer}>
          <LinearGradient
            colors={['#6C5CE7', '#FD79A8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyIconGradient}
          >
            <Ionicons
              name={isVisitedTab ? 'checkmark-circle-outline' : 'bookmark-outline'}
              size={60}
              color="#FFF"
            />
          </LinearGradient>
        </View>
        <Text style={styles.emptyTitle}>
          {isVisitedTab ? 'No Visited Art Yet' : 'No Saved Art Yet'}
        </Text>
        <Text style={styles.emptyDescription}>
          {isVisitedTab
            ? 'Mark installations as visited to track your art journey'
            : 'Start saving art installations to build your collection'}
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation?.navigate?.('Discover')}
          testID="empty-discover-button"
          accessibilityLabel="Go to Discover screen"
        >
          <LinearGradient
            colors={['#6C5CE7', '#FD79A8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyButtonGradient}
          >
            <Ionicons name="compass" size={20} color="#FFF" />
            <Text style={styles.emptyButtonText}>Discover Art</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [activeTab, navigation]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <LinearGradient
        colors={['#0A0E1A', '#1A1F2E']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Gallery</Text>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportCollection}
            disabled={exporting}
            testID="export-button"
            accessibilityLabel="Export collection"
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#6C5CE7" />
            ) : (
              <Ionicons name="share-outline" size={24} color="#6C5CE7" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="bookmark" size={24} color="#6C5CE7" />
            </View>
            <Text style={styles.statValue}>{stats.saved}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#00D9A5" />
            </View>
            <Text style={styles.statValue}>{stats.visited}</Text>
            <Text style={styles.statLabel}>Visited</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="heart" size={24} color="#FD79A8" />
            </View>
            <Text style={styles.statValue}>{stats.favorites}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <View style={styles.tabButtons}>
            {(TABS || []).map((tab, index) => (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabButton}
                onPress={() => handleTabChange(tab.id, index)}
                testID={`tab-${tab.id}`}
                accessibilityLabel={`${tab.label} tab`}
              >
                <Ionicons
                  name={activeTab === tab.id ? tab.icon : `${tab.icon}-outline`}
                  size={20}
                  color={activeTab === tab.id ? '#6C5CE7' : '#8B8FA3'}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.id && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Animated.View style={[styles.tabIndicator, tabIndicatorStyle]} />
        </View>

        {(displayedArt || []).length === 0 ? (
          renderEmptyState()
        ) : (
          <Animated.FlatList
            data={displayedArt}
            renderItem={renderArtCard}
            keyExtractor={(item) => item?.id || Math.random().toString()}
            numColumns={2}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            testID="art-grid"
          />
        )}

        <Modal
          visible={visitModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setVisitModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              entering={FadeIn.duration(200)}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Mark as Visited</Text>
                <TouchableOpacity
                  onPress={() => setVisitModalVisible(false)}
                  testID="close-modal-button"
                  accessibilityLabel="Close modal"
                >
                  <Ionicons name="close" size={24} color="#E8EAF0" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalArtTitle}>
                {selectedArt?.title || 'Untitled'}
              </Text>
              <Text style={styles.modalArtArtist}>
                by {selectedArt?.artist || 'Unknown Artist'}
              </Text>

              <Text style={styles.inputLabel}>Visit Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add your thoughts about this visit..."
                placeholderTextColor="#6A6F7E"
                value={visitNotes}
                onChangeText={setVisitNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                testID="visit-notes-input"
                accessibilityLabel="Visit notes input"
              />

              <TouchableOpacity
                style={styles.saveVisitButton}
                onPress={handleSaveVisit}
                testID="save-visit-button"
                accessibilityLabel="Save visit"
              >
                <LinearGradient
                  colors={['#6C5CE7', '#FD79A8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveVisitGradient}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.saveVisitText}>Save Visit</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      </LinearGradient>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E8EAF0',
  },
  exportButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1F2E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8EAF0',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8B8FA3',
    fontWeight: '600',
  },
  tabContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  tabButtons: {
    flexDirection: 'row',
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B8FA3',
  },
  tabTextActive: {
    color: '#6C5CE7',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: (width - 48) / 2,
    height: 40,
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    borderRadius: 10,
  },
  gridContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  artCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    marginBottom: 16,
    marginRight: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    position: 'relative',
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#2A2F3E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  visitedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 6,
  },
  cardContent: {
    padding: 12,
  },
  artTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E8EAF0',
    marginBottom: 4,
  },
  artArtist: {
    fontSize: 13,
    color: '#8B8FA3',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    color: '#6A6F7E',
  },
  visitDate: {
    fontSize: 11,
    color: '#00D9A5',
    fontWeight: '600',
  },
  markVisitedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  markVisitedText: {
    fontSize: 13,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginRight: 16,
  },
  swipeAction: {
    width: 70,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginLeft: 8,
  },
  shareAction: {
    backgroundColor: '#6C5CE7',
  },
  deleteAction: {
    backgroundColor: '#FF4757',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8EAF0',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    color: '#8B8FA3',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E8EAF0',
  },
  modalArtTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E8EAF0',
    marginBottom: 4,
  },
  modalArtArtist: {
    fontSize: 14,
    color: '#8B8FA3',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8EAF0',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#0A0E1A',
    borderRadius: 12,
    padding: 12,
    color: '#E8EAF0',
    fontSize: 15,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#2A2F3E',
    marginBottom: 20,
  },
  saveVisitButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveVisitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveVisitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
