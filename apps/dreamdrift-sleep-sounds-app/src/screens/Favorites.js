import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { formatDistanceToNow } from 'date-fns';
import { useDreamDrift } from '../context/DreamDriftContext';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARDS_PER_ROW = 2;
const CARD_WIDTH = (width - CARD_MARGIN * (CARDS_PER_ROW + 1)) / CARDS_PER_ROW;

const TABS = [
  { id: 'sounds', label: 'Sounds', icon: 'musical-notes' },
  { id: 'mixes', label: 'Mixes', icon: 'layers' },
];

function SegmentedControl({ tabs, activeTab, onTabChange }) {
  return (
    <View style={styles.segmentedControl} testID="favorites-tabs">
      {(tabs || []).map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTabChange?.(tab.id);
            }}
            testID={`tab-${tab.id}`}
            accessibilityLabel={`${tab.label} tab`}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={isActive ? '#ffffff' : '#e8eaf6'}
              style={styles.segmentIcon}
            />
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FavoriteSoundCard({ sound, isPlaying, onPlay, onPause, onToggleFavorite }) {
  const scale = useSharedValue(1);
  const heartScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handlePlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(0.95, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    if (isPlaying) {
      onPause?.(sound?.id);
    } else {
      onPlay?.(sound?.id);
    }
  };

  const handleFavoritePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.3, { damping: 8 }),
      withSpring(1, { damping: 8 })
    );
    onToggleFavorite?.(sound?.id);
  };

  return (
    <Animated.View style={[styles.soundCardContainer, animatedStyle]}>
      <View style={[styles.soundCard, { borderColor: sound?.color || '#7c4dff' }]}>
        <View style={styles.soundCardHeader}>
          <View style={[styles.soundIconCircle, { backgroundColor: (sound?.color || '#7c4dff') + '20' }]}>
            <Ionicons name={sound?.icon || 'musical-note'} size={28} color={sound?.color || '#7c4dff'} />
          </View>
          <TouchableOpacity
            onPress={handleFavoritePress}
            style={styles.soundFavoriteButton}
            testID={`favorite-sound-toggle-${sound?.id}`}
            accessibilityLabel={`Remove ${sound?.name || 'sound'} from favorites`}
          >
            <Animated.View style={heartAnimatedStyle}>
              <Ionicons name="heart" size={22} color="#ff4081" />
            </Animated.View>
          </TouchableOpacity>
        </View>

        <Text style={styles.soundCardName} numberOfLines={1}>
          {sound?.name || 'Unknown Sound'}
        </Text>
        <Text style={styles.soundCardCategory}>
          {sound?.category || 'ambient'}
        </Text>

        <TouchableOpacity
          onPress={handlePlayPress}
          style={[styles.soundPlayButton, { backgroundColor: sound?.color || '#7c4dff' }]}
          testID={`quick-play-sound-${sound?.id}`}
          accessibilityLabel={`${isPlaying ? 'Pause' : 'Play'} ${sound?.name || 'sound'}`}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function SavedMixItem({ mix, sounds, onPlay, onEdit, onDelete }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(0.98, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    onPlay?.(mix?.id);
  };

  const handleEditPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit?.(mix?.id);
  };

  const handleDeletePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete?.(mix?.id);
  };

  const mixSounds = useMemo(() => {
    return (mix?.sounds || []).map((soundId) => {
      return (sounds || []).find((s) => s?.id === soundId);
    }).filter(Boolean);
  }, [mix?.sounds, sounds]);

  const createdDate = useMemo(() => {
    if (!mix?.createdAt) return 'Recently';
    const d = new Date(mix.createdAt);
    const safe = isNaN(d.getTime()) ? new Date() : d;
    try {
      return formatDistanceToNow(safe, { addSuffix: true });
    } catch (e) {
      return 'Recently';
    }
  }, [mix?.createdAt]);

  return (
    <Animated.View style={[styles.mixItem, animatedStyle]}>
      <LinearGradient
        colors={['#1a1f3a', '#0a0e27']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.mixItemGradient}
      >
        <View style={styles.mixItemHeader}>
          <View style={styles.mixItemLeft}>
            <View style={styles.mixIconContainer}>
              <Ionicons name="layers" size={24} color="#7c4dff" />
            </View>
            <View style={styles.mixInfo}>
              <Text style={styles.mixName} numberOfLines={1}>
                {mix?.name || 'Unnamed Mix'}
              </Text>
              <Text style={styles.mixMeta}>
                {(mixSounds || []).length} sound{(mixSounds || []).length !== 1 ? 's' : ''} • {createdDate}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.mixSoundsPreview}>
          {(mixSounds || []).slice(0, 4).map((sound, index) => (
            <View
              key={sound?.id || index}
              style={[styles.mixSoundBadge, { backgroundColor: (sound?.color || '#7c4dff') + '20' }]}
            >
              <Ionicons name={sound?.icon || 'musical-note'} size={14} color={sound?.color || '#7c4dff'} />
              <Text style={styles.mixSoundBadgeText} numberOfLines={1}>
                {sound?.name || 'Unknown'}
              </Text>
            </View>
          ))}
          {(mixSounds || []).length > 4 && (
            <View style={styles.mixSoundBadgeMore}>
              <Text style={styles.mixSoundBadgeMoreText}>+{(mixSounds || []).length - 4}</Text>
            </View>
          )}
        </View>

        <View style={styles.mixActions}>
          <TouchableOpacity
            onPress={handlePlayPress}
            style={styles.mixPlayButton}
            testID={`quick-play-mix-${mix?.id}`}
            accessibilityLabel={`Play ${mix?.name || 'mix'}`}
          >
            <LinearGradient
              colors={['#7c4dff', '#12142d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mixPlayButtonGradient}
            >
              <Ionicons name="play" size={20} color="#ffffff" />
              <Text style={styles.mixPlayButtonText}>Play</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEditPress}
            style={styles.mixActionButton}
            testID={`edit-mix-${mix?.id}`}
            accessibilityLabel={`Edit ${mix?.name || 'mix'}`}
          >
            <Ionicons name="create-outline" size={22} color="#7c4dff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeletePress}
            style={styles.mixActionButton}
            testID={`delete-mix-${mix?.id}`}
            accessibilityLabel={`Delete ${mix?.name || 'mix'}`}
          >
            <Ionicons name="trash-outline" size={22} color="#ff4081" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function EmptyState({ type }) {
  const isSounds = type === 'sounds';
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  React.useEffect(() => {
    scale.value = withSequence(
      withSpring(1.05, { damping: 8 }),
      withSpring(1, { damping: 8 })
    );
  }, []);

  return (
    <View style={styles.emptyStateContainer} testID={`empty-state-${type}`}>
      <LinearGradient
        colors={['#7c4dff', '#4a148c']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emptyStateGradient}
      >
        <Animated.View style={[styles.emptyStateContent, animatedStyle]}>
          <View style={styles.emptyStateIconContainer}>
            <Ionicons
              name={isSounds ? 'heart-outline' : 'layers-outline'}
              size={64}
              color="#ffffff"
            />
          </View>
          <Text style={styles.emptyStateTitle}>
            {isSounds ? 'Your collection is quiet' : 'No soundscapes crafted'}
          </Text>
          <Text style={styles.emptyStateMessage}>
            {isSounds
              ? 'Tap the heart on any sound to begin curating your personal sanctuary.'
              : 'Create and save your custom sound mixes from the Mix tab to see them here.'}
          </Text>
          <View style={styles.emptyStateHint}>
            <Ionicons name="information-circle-outline" size={18} color="#e8eaf6" />
            <Text style={styles.emptyStateHintText}>
              {isSounds ? 'Browse sounds in the Sounds tab' : 'Start mixing in the Mix tab'}
            </Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

export default function Favorites() {
  const {
    sounds,
    mixes,
    activeSounds,
    playSound,
    pauseSound,
    toggleFavorite,
    deleteMix,
  } = useDreamDrift();

  const [activeTab, setActiveTab] = useState('sounds');

  const favoriteSounds = useMemo(() => {
    return (sounds || []).filter((sound) => sound?.isFavorite === true);
  }, [sounds]);

  const savedMixes = useMemo(() => {
    return (mixes || []).sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
  }, [mixes]);

  const handlePlaySound = (soundId) => {
    playSound?.(soundId);
  };

  const handlePauseSound = (soundId) => {
    pauseSound?.(soundId);
  };

  const handleToggleFavorite = (soundId) => {
    toggleFavorite?.(soundId);
  };

  const handlePlayMix = (mixId) => {
    const mix = (mixes || []).find((m) => m?.id === mixId);
    if (!mix) return;

    (mix?.sounds || []).forEach((soundId) => {
      playSound?.(soundId, mix?.volumes?.[soundId] ?? 0.7);
    });
  };

  const handleEditMix = (mixId) => {
    // Navigation to Mix tab with pre-loaded mix would go here
    // For now, just haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteMix = (mixId) => {
    const mix = (mixes || []).find((m) => m?.id === mixId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteMix?.(mixId);
  };

  const renderSoundCard = ({ item }) => {
    const isPlaying = (activeSounds || []).some((s) => s?.id === item?.id);
    return (
      <FavoriteSoundCard
        sound={item}
        isPlaying={isPlaying}
        onPlay={handlePlaySound}
        onPause={handlePauseSound}
        onToggleFavorite={handleToggleFavorite}
      />
    );
  };

  const renderMixItem = ({ item }) => {
    return (
      <SavedMixItem
        mix={item}
        sounds={sounds}
        onPlay={handlePlayMix}
        onEdit={handleEditMix}
        onDelete={handleDeleteMix}
      />
    );
  };

  const showSoundsEmpty = activeTab === 'sounds' && (favoriteSounds || []).length === 0;
  const showMixesEmpty = activeTab === 'mixes' && (savedMixes || []).length === 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4a148c', '#0a0e27']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Favorites</Text>
        <Text style={styles.headerSubtitle}>
          {activeTab === 'sounds'
            ? `${(favoriteSounds || []).length} favorite sound${(favoriteSounds || []).length !== 1 ? 's' : ''}`
            : `${(savedMixes || []).length} saved mix${(savedMixes || []).length !== 1 ? 'es' : ''}`}
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        <SegmentedControl tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {showSoundsEmpty && <EmptyState type="sounds" />}
        {showMixesEmpty && <EmptyState type="mixes" />}

        {activeTab === 'sounds' && !showSoundsEmpty && (
          <FlatList
            data={favoriteSounds}
            renderItem={renderSoundCard}
            keyExtractor={(item) => item?.id || Math.random().toString()}
            numColumns={CARDS_PER_ROW}
            contentContainerStyle={styles.soundsGrid}
            showsVerticalScrollIndicator={false}
            testID="favorite-sounds-list"
          />
        )}

        {activeTab === 'mixes' && !showMixesEmpty && (
          <FlatList
            data={savedMixes}
            renderItem={renderMixItem}
            keyExtractor={(item) => item?.id || Math.random().toString()}
            contentContainerStyle={styles.mixesList}
            showsVerticalScrollIndicator={false}
            testID="saved-mixes-list"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e8eaf6',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e8eaf6',
    opacity: 0.7,
  },
  content: {
    flex: 1,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#1a1f3a',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 16,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  segmentButtonActive: {
    backgroundColor: '#7c4dff',
  },
  segmentIcon: {
    marginRight: 6,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e8eaf6',
    opacity: 0.6,
  },
  segmentTextActive: {
    opacity: 1,
  },
  soundsGrid: {
    paddingHorizontal: CARD_MARGIN / 2,
    paddingBottom: 100,
  },
  soundCardContainer: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN / 2,
    marginBottom: CARD_MARGIN,
  },
  soundCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
  },
  soundCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  soundIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundFavoriteButton: {
    padding: 4,
  },
  soundCardName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#e8eaf6',
    marginBottom: 4,
  },
  soundCardCategory: {
    fontSize: 13,
    color: '#e8eaf6',
    opacity: 0.6,
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  soundPlayButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixesList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  mixItem: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mixItemGradient: {
    padding: 16,
  },
  mixItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mixItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mixIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c4dff20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mixInfo: {
    flex: 1,
  },
  mixName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e8eaf6',
    marginBottom: 4,
  },
  mixMeta: {
    fontSize: 13,
    color: '#e8eaf6',
    opacity: 0.6,
  },
  mixSoundsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  mixSoundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: '48%',
  },
  mixSoundBadgeText: {
    fontSize: 12,
    color: '#e8eaf6',
    marginLeft: 6,
    fontWeight: '600',
  },
  mixSoundBadgeMore: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#7c4dff20',
    marginBottom: 8,
  },
  mixSoundBadgeMoreText: {
    fontSize: 12,
    color: '#7c4dff',
    fontWeight: '700',
  },
  mixActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mixPlayButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mixPlayButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mixPlayButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  mixActionButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1a1f3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 40,
    borderRadius: 24,
    overflow: 'hidden',
  },
  emptyStateGradient: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  emptyStateIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyStateHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyStateHintText: {
    fontSize: 14,
    color: '#e8eaf6',
    marginLeft: 8,
    fontWeight: '600',
  },
});
