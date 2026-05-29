import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
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
import { useDreamDrift } from '../context/DreamDriftContext';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARDS_PER_ROW = 2;
const CARD_WIDTH = (width - CARD_MARGIN * (CARDS_PER_ROW + 1)) / CARDS_PER_ROW;

const CATEGORIES = [
  { id: 'all', name: 'All Sounds', icon: 'musical-notes' },
  { id: 'rain', name: 'Rain', icon: 'rainy' },
  { id: 'ocean', name: 'Ocean', icon: 'water' },
  { id: 'forest', name: 'Forest', icon: 'leaf' },
  { id: 'ambient', name: 'Ambient', icon: 'radio' },
];

function SoundCard({ sound, isPlaying, onPlay, onPause, onToggleFavorite }) {
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
      onPause?.(sound.id);
    } else {
      onPlay?.(sound.id);
    }
  };

  const handleFavoritePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.3, { damping: 8 }),
      withSpring(1, { damping: 8 })
    );
    onToggleFavorite?.(sound.id);
  };

  return (
    <Animated.View style={[styles.cardContainer, animatedStyle]}>
      <View style={[styles.card, { borderColor: sound.color || '#7c4dff' }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: sound.color + '20' || '#7c4dff20' }]}>
            <Ionicons name={sound.icon || 'musical-note'} size={32} color={sound.color || '#7c4dff'} />
          </View>
          <TouchableOpacity
            onPress={handleFavoritePress}
            style={styles.favoriteButton}
            testID={`sound-favorite-${sound.id}`}
            accessibilityLabel={`${sound.isFavorite ? 'Unfavorite' : 'Favorite'} ${sound.name || 'sound'}`}
          >
            <Animated.View style={heartAnimatedStyle}>
              <Ionicons
                name={sound.isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={sound.isFavorite ? '#ff4081' : '#e8eaf6'}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

        <Text style={styles.soundName} numberOfLines={1}>
          {sound.name || 'Unknown Sound'}
        </Text>
        <Text style={styles.soundCategory} numberOfLines={1}>
          {sound.category || 'ambient'}
        </Text>

        <TouchableOpacity
          onPress={handlePlayPress}
          style={[styles.playButton, { backgroundColor: sound.color || '#7c4dff' }]}
          testID={`sound-play-${sound.id}`}
          accessibilityLabel={`${isPlaying ? 'Pause' : 'Play'} ${sound.name || 'sound'}`}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
          <Text style={styles.playButtonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function CategoryChip({ category, isSelected, onPress }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(0.9, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    onPress?.();
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={handlePress}
        style={[
          styles.categoryChip,
          isSelected && styles.categoryChipSelected,
        ]}
        testID={`category-${category.id}`}
        accessibilityLabel={`Filter by ${category.name || 'category'}`}
      >
        <Ionicons
          name={category.icon || 'musical-notes'}
          size={18}
          color={isSelected ? '#fff' : '#e8eaf6'}
          style={styles.categoryIcon}
        />
        <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
          {category.name || 'Category'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function SoundsLibrary() {
  const {
    sounds,
    activeSounds,
    playSound,
    pauseSound,
    toggleFavorite,
  } = useDreamDrift();

  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredSounds = useMemo(() => {
    const soundsArray = sounds || [];
    if (selectedCategory === 'all') {
      return soundsArray;
    }
    return soundsArray.filter(sound => sound?.category === selectedCategory);
  }, [sounds, selectedCategory]);

  const renderSoundCard = ({ item }) => {
    if (!item) return null;
    const isPlaying = (activeSounds || []).some(activeSound => activeSound?.id === item.id);
    return (
      <SoundCard
        sound={item}
        isPlaying={isPlaying}
        onPlay={playSound}
        onPause={pauseSound}
        onToggleFavorite={toggleFavorite}
      />
    );
  };

  const renderCategoryChip = ({ item }) => {
    if (!item) return null;
    return (
      <CategoryChip
        category={item}
        isSelected={selectedCategory === item.id}
        onPress={() => setSelectedCategory(item.id)}
      />
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState} testID="sounds-empty-state">
      <LinearGradient
        colors={['#7c4dff40', '#23114a40']}
        style={styles.emptyGradient}
      >
        <Ionicons name="musical-notes-outline" size={64} color="#7c4dff" />
        <Text style={styles.emptyTitle}>No Sounds Found</Text>
        <Text style={styles.emptySubtitle}>
          {selectedCategory === 'all'
            ? "Sounds will appear here once loaded"
            : `No ${selectedCategory} sounds available`}
        </Text>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a237e', '#4a148c', '#7c4dff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
        testID="sounds-header-gradient"
      >
        <View style={styles.headerContent}>
          <Ionicons name="musical-notes" size={32} color="#fff" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>DreamDrift</Text>
        </View>
        <Text style={styles.headerSubtitle}>Sleep Sounds Library</Text>
      </LinearGradient>

      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={CATEGORIES}
          renderItem={renderCategoryChip}
          keyExtractor={(item) => item?.id || Math.random().toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          testID="category-filter-list"
        />
      </View>

      <FlatList
        data={filteredSounds}
        renderItem={renderSoundCard}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        numColumns={CARDS_PER_ROW}
        contentContainerStyle={styles.soundsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        testID="sounds-grid"
      />
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerIcon: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e8eaf6',
    opacity: 0.9,
    marginLeft: 44,
  },
  categoriesContainer: {
    paddingVertical: 16,
    backgroundColor: '#0a0e27',
  },
  categoriesList: {
    paddingHorizontal: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 6,
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#7c4dff40',
  },
  categoryChipSelected: {
    backgroundColor: '#7c4dff',
    borderColor: '#7c4dff',
  },
  categoryIcon: {
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e8eaf6',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  soundsList: {
    paddingHorizontal: CARD_MARGIN / 2,
    paddingTop: 8,
    paddingBottom: 100,
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN / 2,
    marginVertical: CARD_MARGIN / 2,
  },
  card: {
    backgroundColor: '#1a1f3a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    padding: 4,
  },
  soundName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e8eaf6',
    marginBottom: 4,
  },
  soundCategory: {
    fontSize: 13,
    color: '#e8eaf6',
    opacity: 0.6,
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyGradient: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e8eaf6',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#e8eaf6',
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
  },
});
