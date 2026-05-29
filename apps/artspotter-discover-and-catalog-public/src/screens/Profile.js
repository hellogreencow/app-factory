import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatDistanceToNow, format } from 'date-fns';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import { useArtSpotter } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

const SETTINGS_OPTIONS = [
  { id: 'notifications', label: 'Notifications', icon: 'notifications', type: 'toggle' },
  { id: 'location', label: 'Location Services', icon: 'location', type: 'toggle' },
  { id: 'theme', label: 'Dark Mode', icon: 'moon', type: 'toggle' },
  { id: 'privacy', label: 'Privacy Settings', icon: 'shield-checkmark', type: 'navigate' },
  { id: 'about', label: 'About ArtSpotter', icon: 'information-circle', type: 'navigate' },
  { id: 'help', label: 'Help & Support', icon: 'help-circle', type: 'navigate' },
];

export default function Profile({ navigation }) {
  const { 
    installations, 
    savedArt, 
    visitedArt, 
    userProfile, 
    updateProfile,
    userStats 
  } = useArtSpotter();

  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    location: true,
    theme: true,
  });

  const editScale = useSharedValue(1);
  const saveScale = useSharedValue(1);
  const exportScale = useSharedValue(1);
  const settingsRotation = useSharedValue(0);

  useEffect(() => {
    if (userProfile) {
      setUsername(userProfile?.username ?? 'Art Enthusiast');
      setBio(userProfile?.bio ?? 'Exploring public art installations');
      setAvatarUri(userProfile?.avatar ?? null);
    }
  }, [userProfile]);

  const stats = useMemo(() => {
    const addedCount = (installations || []).filter((art) => art?.userId === userProfile?.id).length;
    const visitedCount = (visitedArt || []).length;
    const savedCount = (savedArt || []).length;

    return {
      added: addedCount,
      visited: visitedCount,
      saved: savedCount,
    };
  }, [installations, visitedArt, savedArt, userProfile]);

  const recentActivity = useMemo(() => {
    const userInstallations = (installations || [])
      .filter((art) => art?.userId === userProfile?.id)
      .sort((a, b) => {
        const dateA = new Date(a?.dateAdded || 0);
        const dateB = new Date(b?.dateAdded || 0);
        const safeA = isNaN(dateA.getTime()) ? new Date(0) : dateA;
        const safeB = isNaN(dateB.getTime()) ? new Date(0) : dateB;
        return safeB.getTime() - safeA.getTime();
      })
      .slice(0, 5);

    const recentVisits = (visitedArt || [])
      .sort((a, b) => {
        const dateA = new Date(a?.visitDate || 0);
        const dateB = new Date(b?.visitDate || 0);
        const safeA = isNaN(dateA.getTime()) ? new Date(0) : dateA;
        const safeB = isNaN(dateB.getTime()) ? new Date(0) : dateB;
        return safeB.getTime() - safeA.getTime();
      })
      .slice(0, 3)
      .map((visit) => {
        const art = (installations || []).find((item) => item?.id === visit?.artId);
        return { ...visit, art };
      })
      .filter((item) => item?.art);

    return {
      installations: userInstallations,
      visits: recentVisits,
    };
  }, [installations, visitedArt, userProfile]);

  const joinDate = useMemo(() => {
    const date = new Date(userProfile?.joinedDate || Date.now());
    const safeDate = isNaN(date.getTime()) ? new Date() : date;
    return format(safeDate, 'MMMM yyyy');
  }, [userProfile]);

  const handleEditToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    editScale.value = withSequence(
      withSpring(0.9),
      withSpring(1.0)
    );
    setEditMode((prev) => !prev);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveScale.value = withSequence(
      withSpring(0.9),
      withSpring(1.0)
    );

    if (typeof updateProfile === 'function') {
      await updateProfile({
        username: username.trim(),
        bio: bio.trim(),
        avatar: avatarUri,
      });
    }

    setEditMode(false);
  }, [username, bio, avatarUri, updateProfile]);

  const handlePickImage = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  }, []);

  const handleExportData = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    exportScale.value = withSequence(
      withSpring(0.9),
      withSpring(1.0)
    );

    setExporting(true);

    try {
      const userInstallations = (installations || []).filter(
        (art) => art?.userId === userProfile?.id
      );

      const exportData = {
        profile: {
          username: userProfile?.username ?? 'Unknown',
          bio: userProfile?.bio ?? '',
          joinedDate: userProfile?.joinedDate ?? new Date().toISOString(),
        },
        stats: {
          artAdded: stats.added,
          artVisited: stats.visited,
          artSaved: stats.saved,
        },
        installations: userInstallations.map((art) => ({
          title: art?.title ?? 'Untitled',
          artist: art?.artist ?? 'Unknown',
          category: art?.category ?? 'Unknown',
          dateAdded: art?.dateAdded ?? '',
          latitude: art?.latitude ?? 0,
          longitude: art?.longitude ?? 0,
        })),
        savedArt: (savedArt || []).map((id) => {
          const art = (installations || []).find((item) => item?.id === id);
          return {
            title: art?.title ?? 'Untitled',
            artist: art?.artist ?? 'Unknown',
          };
        }),
        exportDate: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const fileName = `artspotter_export_${Date.now()}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export ArtSpotter Data',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Success', `Data exported to ${fileName}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setExporting(false);
    }
  }, [installations, savedArt, userProfile, stats]);

  const handleSettingToggle = useCallback((settingId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings((prev) => ({
      ...prev,
      [settingId]: !prev[settingId],
    }));
  }, []);

  const handleSettingsExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettingsExpanded((prev) => !prev);
    settingsRotation.value = withSpring(settingsExpanded ? 0 : 180);
  }, [settingsExpanded]);

  const editAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: editScale.value }],
  }));

  const saveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const exportAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: exportScale.value }],
  }));

  const settingsIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${settingsRotation.value}deg` }],
  }));

  const renderStatCard = (label, value, icon, color) => (
    <View style={styles.statCard} testID={`stat-card-${label.toLowerCase()}`}>
      <LinearGradient
        colors={[color + '20', color + '10']}
        style={styles.statGradient}
      >
        <View style={[styles.statIconContainer, { backgroundColor: color + '30' }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.statValue} testID={`stat-value-${label.toLowerCase()}`}>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </View>
  );

  const renderRecentActivityItem = (item, index) => {
    const dateObj = new Date(item?.dateAdded || item?.visitDate || Date.now());
    const safeDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
    const timeAgo = formatDistanceToNow(safeDate, { addSuffix: true });

    const artData = item?.art || item;

    return (
      <Animated.View
        key={item?.id || index}
        entering={FadeIn.delay(index * 100)}
        style={styles.activityItem}
        testID={`activity-item-${index}`}
      >
        <TouchableOpacity
          style={styles.activityContent}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (artData?.id) {
              navigation.navigate('ArtDetail', { id: artData.id });
            }
          }}
          activeOpacity={0.7}
          testID={`activity-item-button-${index}`}
          accessibilityLabel={`View ${artData?.title ?? 'art'} details`}
        >
          {artData?.imageUri ? (
            <Image
              source={{ uri: artData.imageUri }}
              style={styles.activityImage}
              testID={`activity-image-${index}`}
            />
          ) : (
            <View style={[styles.activityImage, styles.activityImagePlaceholder]}>
              <Ionicons name="image-outline" size={24} color="#8B8FA3" />
            </View>
          )}
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle} numberOfLines={1}>
              {artData?.title ?? 'Untitled'}
            </Text>
            <Text style={styles.activityArtist} numberOfLines={1}>
              {artData?.artist ?? 'Unknown Artist'}
            </Text>
            <View style={styles.activityMeta}>
              <Ionicons
                name={item?.visitDate ? 'checkmark-circle' : 'add-circle'}
                size={14}
                color="#6C5CE7"
              />
              <Text style={styles.activityTime}>{timeAgo}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8B8FA3" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSettingItem = (setting, index) => {
    const isToggle = setting.type === 'toggle';

    return (
      <Animated.View
        key={setting.id}
        entering={FadeIn.delay(index * 50)}
        style={styles.settingItem}
        testID={`setting-item-${setting.id}`}
      >
        <TouchableOpacity
          style={styles.settingContent}
          onPress={() => {
            if (isToggle) {
              handleSettingToggle(setting.id);
            } else {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert(setting.label, 'This feature is coming soon!');
            }
          }}
          activeOpacity={0.7}
          testID={`setting-button-${setting.id}`}
          accessibilityLabel={setting.label}
        >
          <View style={styles.settingLeft}>
            <View style={styles.settingIconContainer}>
              <Ionicons name={setting.icon} size={22} color="#6C5CE7" />
            </View>
            <Text style={styles.settingLabel}>{setting.label}</Text>
          </View>
          {isToggle ? (
            <View
              style={[
                styles.toggle,
                settings[setting.id] && styles.toggleActive,
              ]}
              testID={`toggle-${setting.id}`}
            >
              <View
                style={[
                  styles.toggleThumb,
                  settings[setting.id] && styles.toggleThumbActive,
                ]}
              />
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color="#8B8FA3" />
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container} testID="profile-screen">
      <LinearGradient
        colors={['#6C5CE7', '#0A0E1A']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle} testID="profile-header-title">
            Profile
          </Text>
          <Animated.View style={editAnimatedStyle}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={editMode ? handleSaveProfile : handleEditToggle}
              testID="edit-profile-button"
              accessibilityLabel={editMode ? 'Save profile' : 'Edit profile'}
            >
              <Ionicons
                name={editMode ? 'checkmark' : 'create-outline'}
                size={24}
                color="#E8EAF0"
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="profile-scroll-view"
      >
        <View style={styles.profileHeader} testID="profile-header">
          <TouchableOpacity
            onPress={editMode ? handlePickImage : undefined}
            disabled={!editMode}
            activeOpacity={0.7}
            testID="avatar-button"
            accessibilityLabel="Change profile picture"
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                testID="profile-avatar"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="#6C5CE7" />
              </View>
            )}
            {editMode && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={16} color="#E8EAF0" />
              </View>
            )}
          </TouchableOpacity>

          {editMode ? (
            <View style={styles.editForm}>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor="#8B8FA3"
                testID="username-input"
                accessibilityLabel="Username input"
              />
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Bio"
                placeholderTextColor="#8B8FA3"
                multiline
                numberOfLines={3}
                testID="bio-input"
                accessibilityLabel="Bio input"
              />
            </View>
          ) : (
            <>
              <Text style={styles.username} testID="profile-username">
                {username}
              </Text>
              <Text style={styles.bio} testID="profile-bio">
                {bio}
              </Text>
              <View style={styles.joinDateContainer}>
                <Ionicons name="calendar-outline" size={16} color="#8B8FA3" />
                <Text style={styles.joinDate} testID="profile-join-date">
                  Joined {joinDate}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.statsContainer} testID="activity-stats">
          <Text style={styles.sectionTitle}>Activity Stats</Text>
          <View style={styles.statsGrid}>
            {renderStatCard('Added', stats.added, 'add-circle', '#6C5CE7')}
            {renderStatCard('Visited', stats.visited, 'checkmark-circle', '#FD79A8')}
            {renderStatCard('Saved', stats.saved, 'bookmark', '#00B894')}
          </View>
        </View>

        <View style={styles.recentActivityContainer} testID="recent-activity">
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivity.installations.length === 0 && recentActivity.visits.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color="#8B8FA3" />
              <Text style={styles.emptyStateText}>No recent activity</Text>
              <Text style={styles.emptyStateSubtext}>
                Start exploring and adding art to see your activity here
              </Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {[...recentActivity.installations, ...recentActivity.visits]
                .slice(0, 5)
                .map((item, index) => renderRecentActivityItem(item, index))}
            </View>
          )}
        </View>

        <View style={styles.settingsContainer} testID="settings-menu">
          <TouchableOpacity
            style={styles.settingsHeader}
            onPress={handleSettingsExpand}
            activeOpacity={0.7}
            testID="settings-header-button"
            accessibilityLabel="Toggle settings menu"
          >
            <Text style={styles.sectionTitle}>Settings</Text>
            <Animated.View style={settingsIconStyle}>
              <Ionicons name="chevron-down" size={24} color="#E8EAF0" />
            </Animated.View>
          </TouchableOpacity>

          {settingsExpanded && (
            <Animated.View entering={FadeIn} style={styles.settingsList}>
              {SETTINGS_OPTIONS.map((setting, index) => renderSettingItem(setting, index))}
            </Animated.View>
          )}
        </View>

        <View style={styles.exportContainer} testID="export-data">
          <Animated.View style={exportAnimatedStyle}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportData}
              disabled={exporting}
              activeOpacity={0.7}
              testID="export-data-button"
              accessibilityLabel="Export user data"
            >
              <LinearGradient
                colors={['#6C5CE7', '#5F4FD1']}
                style={styles.exportGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {exporting ? (
                  <ActivityIndicator color="#E8EAF0" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={24} color="#E8EAF0" />
                    <Text style={styles.exportButtonText}>Export My Data</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.exportDescription}>
            Download all your art installations, saved collections, and activity data
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ArtSpotter v1.0.0</Text>
          <Text style={styles.footerSubtext}>
            Made with ❤️ for art enthusiasts
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E8EAF0',
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#1A1F2E',
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#6C5CE7',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2A2F3E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#6C5CE7',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1A1F2E',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8EAF0',
    marginTop: 16,
  },
  bio: {
    fontSize: 16,
    color: '#8B8FA3',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  joinDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  joinDate: {
    fontSize: 14,
    color: '#8B8FA3',
  },
  editForm: {
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  input: {
    backgroundColor: '#2A2F3E',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#E8EAF0',
    borderWidth: 1,
    borderColor: '#3A3F4E',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E8EAF0',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 16,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentActivityContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  activityImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  activityImagePlaceholder: {
    backgroundColor: '#2A2F3E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8EAF0',
  },
  activityArtist: {
    fontSize: 14,
    color: '#8B8FA3',
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#8B8FA3',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8EAF0',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8B8FA3',
    textAlign: 'center',
    marginTop: 8,
  },
  settingsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingsList: {
    gap: 12,
  },
  settingItem: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C5CE720',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E8EAF0',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2F3E',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#6C5CE7',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8EAF0',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  exportContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  exportButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  exportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8EAF0',
  },
  exportDescription: {
    fontSize: 14,
    color: '#8B8FA3',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#8B8FA3',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#6B6F83',
    marginTop: 4,
  },
});
