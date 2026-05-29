import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  Alert,
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

const { width, height } = Dimensions.get('window');

function VolumeSlider({ sound, volume, onVolumeChange, onRemove }) {
  const sliderScale = useSharedValue(1);
  const [localVolume, setLocalVolume] = useState(volume);

  const animatedSliderStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sliderScale.value }],
  }));

  const handleVolumeStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sliderScale.value = withSpring(1.05, { damping: 10 });
  };

  const handleVolumeEnd = () => {
    sliderScale.value = withSpring(1, { damping: 10 });
    onVolumeChange?.(sound.id, localVolume);
  };

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove?.(sound.id);
  };

  const volumePercentage = Math.round(localVolume * 100);

  return (
    <View style={styles.soundItem} testID={`active-sound-${sound.id}`}>
      <View style={styles.soundItemHeader}>
        <View style={styles.soundItemLeft}>
          <View style={[styles.soundIcon, { backgroundColor: (sound.color || '#7c4dff') + '20' }]}>
            <Ionicons name={sound.icon || 'musical-note'} size={24} color={sound.color || '#7c4dff'} />
          </View>
          <View style={styles.soundInfo}>
            <Text style={styles.soundItemName} numberOfLines={1}>
              {sound.name || 'Unknown Sound'}
            </Text>
            <Text style={styles.soundCategory}>
              {sound.category || 'ambient'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleRemove}
          style={styles.removeButton}
          testID={`remove-sound-${sound.id}`}
          accessibilityLabel={`Remove ${sound.name || 'sound'} from mix`}
        >
          <Ionicons name="close-circle" size={28} color="#ff4081" />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.sliderContainer, animatedSliderStyle]}>
        <View style={styles.sliderTrack}>
          <View
            style={[
              styles.sliderFill,
              {
                width: `${volumePercentage}%`,
                backgroundColor: sound.color || '#7c4dff',
              },
            ]}
          />
          <View
            style={[
              styles.sliderThumb,
              {
                left: `${volumePercentage}%`,
                backgroundColor: sound.color || '#7c4dff',
              },
            ]}
            onTouchStart={handleVolumeStart}
            onTouchEnd={handleVolumeEnd}
            onResponderGrant={handleVolumeStart}
            onResponderRelease={handleVolumeEnd}
          />
        </View>
        <View style={styles.sliderLabels}>
          <Ionicons name="volume-mute" size={16} color="#e8eaf680" />
          <Text style={styles.volumeText}>{volumePercentage}%</Text>
          <Ionicons name="volume-high" size={16} color="#e8eaf680" />
        </View>
      </Animated.View>

      <View style={styles.sliderInputContainer}>
        <TouchableOpacity
          onPress={() => {
            const newVol = Math.max(0, localVolume - 0.1);
            setLocalVolume(newVol);
            onVolumeChange?.(sound.id, newVol);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.volumeButton}
          testID={`volume-down-${sound.id}`}
          accessibilityLabel="Decrease volume"
        >
          <Ionicons name="remove" size={20} color="#e8eaf6" />
        </TouchableOpacity>
        <View style={styles.sliderInputWrapper}>
          <TextInput
            style={styles.sliderInput}
            value={volumePercentage.toString()}
            onChangeText={(text) => {
              const num = parseInt(text, 10);
              if (!isNaN(num) && num >= 0 && num <= 100) {
                const newVol = num / 100;
                setLocalVolume(newVol);
                onVolumeChange?.(sound.id, newVol);
              }
            }}
            keyboardType="number-pad"
            maxLength={3}
            testID={`volume-input-${sound.id}`}
            accessibilityLabel={`Volume input for ${sound.name || 'sound'}`}
          />
        </View>
        <TouchableOpacity
          onPress={() => {
            const newVol = Math.min(1, localVolume + 0.1);
            setLocalVolume(newVol);
            onVolumeChange?.(sound.id, newVol);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.volumeButton}
          testID={`volume-up-${sound.id}`}
          accessibilityLabel="Increase volume"
        >
          <Ionicons name="add" size={20} color="#e8eaf6" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AddSoundBottomSheet({ visible, onClose, onAddSound }) {
  const { sounds } = useDreamDrift();
  const slideAnim = useSharedValue(visible ? 0 : height);

  React.useEffect(() => {
    if (visible) {
      slideAnim.value = withSpring(0, { damping: 20 });
    } else {
      slideAnim.value = withSpring(height, { damping: 20 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  const handleAddSound = (sound) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddSound?.(sound);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="add-sound-modal"
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
        testID="modal-overlay"
        accessibilityLabel="Close add sound sheet"
      >
        <Animated.View style={[styles.bottomSheet, animatedStyle]}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Add Sound to Mix</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                testID="close-bottom-sheet"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={28} color="#e8eaf6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.soundsList}
              contentContainerStyle={styles.soundsListContent}
              showsVerticalScrollIndicator={false}
            >
              {(sounds || []).map((sound) => (
                <TouchableOpacity
                  key={sound.id}
                  style={styles.soundSelectItem}
                  onPress={() => handleAddSound(sound)}
                  testID={`add-sound-option-${sound.id}`}
                  accessibilityLabel={`Add ${sound.name || 'sound'} to mix`}
                >
                  <View style={[styles.soundSelectIcon, { backgroundColor: (sound.color || '#7c4dff') + '20' }]}>
                    <Ionicons name={sound.icon || 'musical-note'} size={28} color={sound.color || '#7c4dff'} />
                  </View>
                  <View style={styles.soundSelectInfo}>
                    <Text style={styles.soundSelectName}>{sound.name || 'Unknown'}</Text>
                    <Text style={styles.soundSelectCategory}>{sound.category || 'ambient'}</Text>
                  </View>
                  <Ionicons name="add-circle" size={32} color="#7c4dff" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

function SaveMixModal({ visible, onClose, onSave }) {
  const [mixName, setMixName] = useState('');

  const handleSave = () => {
    if (mixName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave?.(mixName.trim());
      setMixName('');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Please enter a name for your mix');
    }
  };

  const handleClose = () => {
    setMixName('');
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      testID="save-mix-modal"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.saveModal}>
          <LinearGradient
            colors={['#7c4dff', '#4a148c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveModalGradient}
          >
            <View style={styles.saveModalHeader}>
              <Ionicons name="save" size={32} color="#fff" />
              <Text style={styles.saveModalTitle}>Save Mix</Text>
            </View>

            <View style={styles.saveModalBody}>
              <Text style={styles.saveModalLabel}>Mix Name</Text>
              <TextInput
                style={styles.saveModalInput}
                placeholder="e.g., Rainy Forest"
                placeholderTextColor="#e8eaf680"
                value={mixName}
                onChangeText={setMixName}
                autoFocus
                testID="save-mix-name-input"
                accessibilityLabel="Mix name input"
              />
            </View>

            <View style={styles.saveModalActions}>
              <TouchableOpacity
                style={styles.saveModalButton}
                onPress={handleClose}
                testID="cancel-save-mix"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.saveModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalButton, styles.saveModalButtonPrimary]}
                onPress={handleSave}
                testID="confirm-save-mix"
                accessibilityLabel="Save mix"
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={[styles.saveModalButtonText, styles.saveModalButtonTextPrimary]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

export default function SoundMixer() {
  const {
    sounds,
    currentMix,
    activeSounds,
    isPlaying,
    playSound,
    pauseSound,
    stopAll,
    setVolume,
    addToMix,
    removeFromMix,
    saveMix,
  } = useDreamDrift();

  const [masterVolume, setMasterVolume] = useState(0.8);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const masterScale = useSharedValue(1);
  const addButtonScale = useSharedValue(1);

  const activeSoundsWithData = useMemo(() => {
    return (activeSounds || [])
      .map((activeSound) => {
        const soundData = (sounds || []).find((s) => s.id === activeSound.id);
        return soundData ? { ...soundData, volume: activeSound.volume ?? 0.7 } : null;
      })
      .filter(Boolean);
  }, [activeSounds, sounds]);

  const handlePlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    masterScale.value = withSequence(
      withSpring(0.9, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );

    if (isPlaying) {
      pauseSound();
    } else {
      if (activeSoundsWithData.length > 0) {
        activeSoundsWithData.forEach((sound) => {
          playSound?.(sound.id);
        });
      }
    }
  };

  const handleStopAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stopAll?.();
  };

  const handleMasterVolumeChange = (newVolume) => {
    setMasterVolume(newVolume);
    activeSoundsWithData.forEach((sound) => {
      setVolume?.(sound.id, sound.volume * newVolume);
    });
  };

  const handleVolumeChange = (soundId, volume) => {
    setVolume?.(soundId, volume * masterVolume);
  };

  const handleRemoveSound = (soundId) => {
    removeFromMix?.(soundId);
  };

  const handleAddSound = (sound) => {
    const alreadyInMix = activeSoundsWithData.some((s) => s.id === sound.id);
    if (alreadyInMix) {
      Alert.alert('Already in Mix', `${sound.name || 'This sound'} is already in your mix`);
      return;
    }
    addToMix?.(sound.id, 0.7);
    setShowAddSheet(false);
  };

  const handleSaveMix = (name) => {
    const soundIds = activeSoundsWithData.map((s) => s.id);
    const volumes = {};
    activeSoundsWithData.forEach((s) => {
      volumes[s.id] = s.volume;
    });
    saveMix?.(name, soundIds, volumes);
    setShowSaveModal(false);
    Alert.alert('Success', `Mix "${name}" saved successfully!`);
  };

  const handleAddButtonPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addButtonScale.value = withSequence(
      withSpring(0.85, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    setShowAddSheet(true);
  };

  const masterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: masterScale.value }],
  }));

  const addButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addButtonScale.value }],
  }));

  const masterVolumePercentage = Math.round(masterVolume * 100);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0e27', '#1a1f3a']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Ionicons name="layers" size={32} color="#7c4dff" />
            <Text style={styles.headerTitle}>Sound Mixer</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {activeSoundsWithData.length} {activeSoundsWithData.length === 1 ? 'sound' : 'sounds'} in mix
          </Text>
        </View>

        <View style={styles.masterControls}>
          <LinearGradient
            colors={['#7c4dff20', '#4a148c20']}
            style={styles.masterCard}
          >
            <View style={styles.masterHeader}>
              <Ionicons name="settings" size={24} color="#7c4dff" />
              <Text style={styles.masterTitle}>Master Controls</Text>
            </View>

            <View style={styles.masterButtons}>
              <Animated.View style={masterAnimatedStyle}>
                <TouchableOpacity
                  style={[styles.masterButton, isPlaying && styles.masterButtonActive]}
                  onPress={handlePlayPause}
                  testID="master-play-pause"
                  accessibilityLabel={isPlaying ? 'Pause all sounds' : 'Play all sounds'}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={32}
                    color="#fff"
                  />
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={styles.masterButtonSecondary}
                onPress={handleStopAll}
                testID="master-stop"
                accessibilityLabel="Stop all sounds"
              >
                <Ionicons name="stop" size={24} color="#e8eaf6" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.masterButtonSecondary}
                onPress={() => {
                  if (activeSoundsWithData.length === 0) {
                    Alert.alert('No Sounds', 'Add some sounds to your mix before saving');
                    return;
                  }
                  setShowSaveModal(true);
                }}
                testID="save-mix-button"
                accessibilityLabel="Save current mix"
              >
                <Ionicons name="save" size={24} color="#e8eaf6" />
              </TouchableOpacity>
            </View>

            <View style={styles.masterVolumeContainer}>
              <Text style={styles.masterVolumeLabel}>Master Volume</Text>
              <View style={styles.masterVolumeSlider}>
                <Ionicons name="volume-low" size={20} color="#e8eaf680" />
                <View style={styles.masterSliderTrack}>
                  <View
                    style={[
                      styles.masterSliderFill,
                      { width: `${masterVolumePercentage}%` },
                    ]}
                  />
                </View>
                <Text style={styles.masterVolumeValue}>{masterVolumePercentage}%</Text>
                <Ionicons name="volume-high" size={20} color="#e8eaf680" />
              </View>
              <View style={styles.masterVolumeButtons}>
                <TouchableOpacity
                  onPress={() => {
                    const newVol = Math.max(0, masterVolume - 0.1);
                    handleMasterVolumeChange(newVol);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.volumeButton}
                  testID="master-volume-down"
                  accessibilityLabel="Decrease master volume"
                >
                  <Ionicons name="remove" size={20} color="#e8eaf6" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const newVol = Math.min(1, masterVolume + 0.1);
                    handleMasterVolumeChange(newVol);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.volumeButton}
                  testID="master-volume-up"
                  accessibilityLabel="Increase master volume"
                >
                  <Ionicons name="add" size={20} color="#e8eaf6" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>

        <ScrollView
          style={styles.soundsContainer}
          contentContainerStyle={styles.soundsContent}
          showsVerticalScrollIndicator={false}
        >
          {activeSoundsWithData.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['#7c4dff20', '#4a148c20']}
                style={styles.emptyStateCard}
              >
                <Ionicons name="musical-notes-outline" size={64} color="#7c4dff40" />
                <Text style={styles.emptyStateTitle}>No Sounds in Mix</Text>
                <Text style={styles.emptyStateText}>
                  Tap the + button below to add sounds and create your perfect mix
                </Text>
              </LinearGradient>
            </View>
          ) : (
            (activeSoundsWithData || []).map((sound) => (
              <VolumeSlider
                key={sound.id}
                sound={sound}
                volume={sound.volume}
                onVolumeChange={handleVolumeChange}
                onRemove={handleRemoveSound}
              />
            ))
          )}
        </ScrollView>

        <Animated.View style={[styles.addButtonContainer, addButtonAnimatedStyle]}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddButtonPress}
            testID="add-sound-button"
            accessibilityLabel="Add sound to mix"
          >
            <LinearGradient
              colors={['#7c4dff', '#4a148c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButtonGradient}
            >
              <Ionicons name="add" size={32} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <AddSoundBottomSheet
          visible={showAddSheet}
          onClose={() => setShowAddSheet(false)}
          onAddSound={handleAddSound}
        />

        <SaveMixModal
          visible={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveMix}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e8eaf6',
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e8eaf680',
    marginLeft: 44,
  },
  masterControls: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  masterCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#7c4dff40',
  },
  masterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  masterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e8eaf6',
    marginLeft: 12,
  },
  masterButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  masterButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7c4dff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  masterButtonActive: {
    backgroundColor: '#4a148c',
  },
  masterButtonSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1f3a',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#7c4dff40',
  },
  masterVolumeContainer: {
    marginTop: 8,
  },
  masterVolumeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e8eaf6',
    marginBottom: 12,
  },
  masterVolumeSlider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masterSliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#1a1f3a',
    borderRadius: 3,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  masterSliderFill: {
    height: '100%',
    backgroundColor: '#7c4dff',
    borderRadius: 3,
  },
  masterVolumeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e8eaf6',
    width: 40,
    textAlign: 'center',
  },
  masterVolumeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  soundsContainer: {
    flex: 1,
  },
  soundsContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  soundItem: {
    backgroundColor: '#1a1f3a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7c4dff20',
  },
  soundItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  soundItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  soundIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  soundInfo: {
    flex: 1,
  },
  soundItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaf6',
    marginBottom: 4,
  },
  soundCategory: {
    fontSize: 12,
    color: '#e8eaf680',
    textTransform: 'capitalize',
  },
  removeButton: {
    padding: 4,
  },
  sliderContainer: {
    marginBottom: 12,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: '#0a0e27',
    borderRadius: 4,
    position: 'relative',
    marginBottom: 8,
  },
  sliderFill: {
    height: '100%',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volumeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e8eaf6',
  },
  sliderInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0a0e27',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#7c4dff40',
  },
  sliderInputWrapper: {
    marginHorizontal: 16,
  },
  sliderInput: {
    width: 60,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0a0e27',
    borderWidth: 1,
    borderColor: '#7c4dff40',
    color: '#e8eaf6',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateCard: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7c4dff20',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e8eaf6',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#e8eaf680',
    textAlign: 'center',
    lineHeight: 20,
  },
  addButtonContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
  },
  addButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 39, 0.9)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#1a1f3a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.7,
    borderTopWidth: 2,
    borderTopColor: '#7c4dff',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#7c4dff40',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#7c4dff20',
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e8eaf6',
  },
  closeButton: {
    padding: 4,
  },
  soundsList: {
    maxHeight: height * 0.5,
  },
  soundsListContent: {
    padding: 20,
  },
  soundSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0e27',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#7c4dff20',
  },
  soundSelectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  soundSelectInfo: {
    flex: 1,
  },
  soundSelectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaf6',
    marginBottom: 4,
  },
  soundSelectCategory: {
    fontSize: 12,
    color: '#e8eaf680',
    textTransform: 'capitalize',
  },
  saveModal: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  saveModalGradient: {
    padding: 24,
  },
  saveModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  saveModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  saveModalBody: {
    marginBottom: 24,
  },
  saveModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  saveModalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  saveModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 6,
  },
  saveModalButtonPrimary: {
    backgroundColor: '#fff',
  },
  saveModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  saveModalButtonTextPrimary: {
    color: '#7c4dff',
    marginLeft: 8,
  },
});
