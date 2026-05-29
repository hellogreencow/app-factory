import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { formatDistanceToNow } from 'date-fns';
import { useArtSpotter } from '../context/AppContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'Mural', label: 'Murals', icon: 'color-palette' },
  { id: 'Sculpture', label: 'Sculptures', icon: 'cube' },
  { id: 'Installation', label: 'Installations', icon: 'bulb' },
  { id: 'Street Art', label: 'Street Art', icon: 'brush' },
  { id: 'Digital', label: 'Digital', icon: 'phone-portrait' },
];

const SORT_OPTIONS = [
  { id: 'dateAdded', label: 'Recent', icon: 'time' },
  { id: 'popularity', label: 'Popular', icon: 'flame' },
  { id: 'distance', label: 'Nearby', icon: 'location' },
];

export default function Discover({ navigation }) {
  const { installations, savedArt, toggleSaveArt } = useArtSpotter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSort, setSelectedSort] = useState('dateAdded');
  const [refreshing, setRefreshing] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const searchScale = useSharedValue(1);
  const sortScale = useSharedValue(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredAndSortedArt = useMemo(() => {
    let filtered = (installations || []).filter((art) => {
      const matchesCategory = selectedCategory === 'all' || art?.category === selectedCategory;
      
      const matchesSearch = !debouncedSearch || 
        art?.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        art?.artist?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        art?.category?.toLowerCase().includes(debouncedSearch.toLowerCase());

      return matchesCategory && matchesSearch;
    });

    filtered.sort((a, b) => {
      if (selectedSort === 'dateAdded') {
        const dateA = new Date(a?.dateAdded || 0);
        const dateB = new Date(b?.dateAdded || 0);
        const safeA = isNaN(dateA.getTime()) ? new Date(0) : dateA;
        const safeB = isNaN(dateB.getTime()) ? new Date(0) : dateB;
        return safeB.getTime() - safeA.getTime();
      } else if (selectedSort === 'popularity') {
        return (b?.likes || 0) - (a?.likes || 0);
      } else if (selectedSort === 'distance') {
        return 0;
      }
      return 0;
    });

    return filtered;
  }, [installations, selectedCategory, debouncedSearch, selectedSort]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleCategoryPress = useCallback((categoryId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(categoryId);
  }, []);

  const handleSortPress = useCallback((sortId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSort(sortId);
    sortScale.value = withSpring(1.1, {}, () => {
      sortScale.value = withSpring(1);
    });
  }, []);

  const handleArtPress = useCallback((art) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation?.navigate?.('ArtDetail', { artId: art?.id });
  }, [navigation]);

  const handleSavePress = useCallback((art, event) => {
    event?.stopPropagation?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleSaveArt?.(art?.id);
  }, [toggleSaveArt]);

  const isSaved = useCallback((artId) => {
    return (savedArt || []).includes(artId);
  }, [savedArt]);

  const renderArtCard = useCallback(({ item }) => {
    const dateObj = new Date(item?.dateAdded || Date.now());
    const safeDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
    const timeAgo = formatDistanceToNow(safeDate, { addSuffix: true });
    const saved = isSaved(item?.id);

    return (
      <Animated.View entering={FadeIn} exiting={FadeOut}>
        <TouchableOpacity
          style={styles.artCard}
          onPress={() => handleArtPress(item)}
          activeOpacity={0.8}
          testID={`art-card-${item?.id}`}
          accessibilityLabel={`Art card for ${item?.title || 'Unknown'}`}
        >
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item?.imageUri || 'https://via.placeholder.com/400' }}
              style={styles.artImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.imageGradient}
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={(e) => handleSavePress(item, e)}
              testID={`save-button-${item?.id}`}
              accessibilityLabel={saved ? "Unsave art" : "Save art"}
            >
              <Ionicons
                name={saved ? 'heart' : 'heart-outline'}
                size={22}
                color={saved ? '#FD79A8' : '#E8EAF0'}
              />
            </TouchableOpacity>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item?.category || 'Art'}</Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.artTitle} numberOfLines={1}>
              {item?.title || 'Untitled'}
            </Text>
            <View style={styles.artistRow}>
              <Ionicons name="person-outline" size={12} color="#8B8FA3" />
              <Text style={styles.artistText} numberOfLines={1}>
                {item?.artist || 'Unknown Artist'}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="heart" size={12} color="#FD79A8" />
                <Text style={styles.statText}>{item?.likes || 0}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="eye" size={12} color="#6C5CE7" />
                <Text style={styles.statText}>{item?.visits || 0}</Text>
              </View>
              <Text style={styles.timeText}>{timeAgo}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [handleArtPress, handleSavePress, isSaved]);

  const renderCategoryChip = useCallback(({ item }) => {
    const isSelected = selectedCategory === item.id;
    return (
      <TouchableOpacity
        style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
        onPress={() => handleCategoryPress(item.id)}
        activeOpacity={0.7}
        testID={`category-chip-${item.id}`}
        accessibilityLabel={`Filter by ${item.label}`}
      >
        <Ionicons
          name={item.icon}
          size={18}
          color={isSelected ? '#E8EAF0' : '#8B8FA3'}
        />
        <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedCategory, handleCategoryPress]);

  const renderSortOption = useCallback(({ item }) => {
    const isSelected = selectedSort === item.id;
    return (
      <TouchableOpacity
        style={[styles.sortOption, isSelected && styles.sortOptionSelected]}
        onPress={() => handleSortPress(item.id)}
        activeOpacity={0.7}
        testID={`sort-option-${item.id}`}
        accessibilityLabel={`Sort by ${item.label}`}
      >
        <Ionicons
          name={item.icon}
          size={16}
          color={isSelected ? '#E8EAF0' : '#8B8FA3'}
        />
        <Text style={[styles.sortOptionText, isSelected && styles.sortOptionTextSelected]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedSort, handleSortPress]);

  const renderEmptyState = useCallback(() => {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={64} color="#2A2F3E" />
        <Text style={styles.emptyTitle}>No Art Found</Text>
        <Text style={styles.emptySubtitle}>
          {debouncedSearch
            ? "Try adjusting your search or filters"
            : "Start exploring by searching or selecting a category"}
        </Text>
      </View>
    );
  }, [debouncedSearch]);

  const renderHeader = useCallback(() => {
    return (
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8B8FA3" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search art, artists, categories..."
            placeholderTextColor="#8B8FA3"
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="search-input"
            accessibilityLabel="Search art installations"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              testID="clear-search-button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color="#8B8FA3" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filtersSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="filter" size={16} color="#E8EAF0" />
            <Text style={styles.sectionTitle}>Categories</Text>
          </View>
          <FlatList
            horizontal
            data={CATEGORIES}
            renderItem={renderCategoryChip}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
            testID="category-filter-list"
          />
        </View>

        <View style={styles.sortSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-vertical" size={16} color="#E8EAF0" />
            <Text style={styles.sectionTitle}>Sort By</Text>
          </View>
          <View style={styles.sortOptions}>
            {SORT_OPTIONS.map((option) => (
              <View key={option.id}>
                {renderSortOption({ item: option })}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredAndSortedArt.length} {filteredAndSortedArt.length === 1 ? 'Installation' : 'Installations'}
          </Text>
        </View>
      </View>
    );
  }, [searchQuery, renderCategoryChip, renderSortOption, filteredAndSortedArt.length]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6C5CE7', '#0A0E1A']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>Discover</Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            testID="filter-button"
            accessibilityLabel="Advanced filters"
          >
            <Ionicons name="options-outline" size={24} color="#E8EAF0" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={filteredAndSortedArt}
        renderItem={renderArtCard}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6C5CE7"
            colors={['#6C5CE7']}
            testID="pull-refresh"
          />
        }
        testID="art-feed-list"
      />
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
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E8EAF0',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#E8EAF0',
  },
  filtersSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8EAF0',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryList: {
    paddingRight: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  categoryChipSelected: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B8FA3',
    marginLeft: 6,
  },
  categoryChipTextSelected: {
    color: '#E8EAF0',
  },
  sortSection: {
    marginBottom: 20,
  },
  sortOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sortOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1F2E',
    borderRadius: 10,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#2A2F3E',
  },
  sortOptionSelected: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B8FA3',
    marginLeft: 6,
  },
  sortOptionTextSelected: {
    color: '#E8EAF0',
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B8FA3',
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  artCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    marginBottom: 16,
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
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  saveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(108,92,231,0.9)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E8EAF0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 12,
  },
  artTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E8EAF0',
    marginBottom: 6,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  artistText: {
    fontSize: 12,
    color: '#8B8FA3',
    marginLeft: 4,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B8FA3',
    marginLeft: 4,
  },
  timeText: {
    fontSize: 10,
    color: '#6B6F7F',
    flex: 1,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E8EAF0',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8B8FA3',
    textAlign: 'center',
    lineHeight: 20,
  },
});
