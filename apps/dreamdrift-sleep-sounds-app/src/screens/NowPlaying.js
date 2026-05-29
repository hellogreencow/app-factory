import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { formatDistanceToNow } from 'date-fns';
import { useDreamDrift } from '../context/DreamDriftContext';

const { width, height } = Dimensions.get('window');

const WAVE_COUNT = 5;
const WAVE_HEIGHT = 80;

function AudioVisualizer({ isPlaying, activeSounds }) {
  const waveAnimations = Array.from({ length: WAVE_COUNT }, () => useSharedValue(0));

  useEffect(() => {
    if (isPlaying && (activeSounds || []).length > 0) {
      waveAnimations.forEach((anim, index) => {
        anim.value = withRepeat(
          withTiming(1, {
            duration: 1500 + index * 200,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true
        );
      });
    } else {
      waveAnimations.forEach((anim) => {
        anim.value = withTiming(0, { duration: 500 });
      });
    }
  }, [isPlaying, (activeSounds || []).length]);

  const createWavePath = (index, animValue) => {
    const amplitude = interpolate(
      animValue,
      [0, 1],
      [5, WAVE_HEIGHT],
      Extrapolate.CLAMP
    );
    const frequency = 0.02 + index * 0.005;
    const phase = index * 0.5;

    let path = `M 0 ${height / 2}`;
    for (let x = 0; x <= width; x += 5) {
      const y = height / 2 + Math.sin(x * frequency + phase) * amplitude;
      path += ` L ${x} ${y}`;
    }
    return path;
  };

  return (
    <View style={styles.visualizerContainer} testID="audio-visualizer">
      <Svg width={width} height={height} style={styles.visualizerSvg}>
        {waveAnimations.map((anim, index) => {
          const animatedProps = useAnimatedStyle(() => {
            return {
              opacity: interpolate(
                anim.value,
                [0, 1],
                [0.1, 0.4 - index * 0.05],
                Extrapolate.CLAMP
              ),
            };
          });

          const color = (activeSounds || [])[index % (activeSounds || []).length]?.color || '#9276ff';

          return (
            <Animated.View key={index} style={[StyleSheet.absoluteFill, animatedProps]}>
              <Svg width={width} height={height}>
                <Path
                  d={createWavePath(index, anim.value)}
                  stroke={color}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
            </Animated.View>
          );
        })}
      </Svg>
      {!isPlaying && (
        <View style={styles.visualizerPlaceholder}>
          <Ionicons name="pulse-outline" size={80} color="#7c4dff" style={{ opacity: 0.3 }} />
          <Text style={styles.visualizerPlaceholderText}>Press play to start</Text>
        </View>
      )}
    </View>
  );
}

function PlaybackControls({ isPlaying, onPlayPause, onVolumePress, onTimerPress }) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  const handlePlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    scale.value = withSequence(
      withSpring(0.9, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    rotation.value = withSequence(
      withSpring(5, { damping: 8 }),
      withSpring(-5, { damping: 8 }),
      withSpring(0, { damping: 8 })
    );
    if (typeof onPlayPause === 'function') {
      onPlayPause();
    }
  };

  const handleVolumePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (typeof onVolumePress === 'function') {
      onVolumePress();
    }
  };

  const handleTimerPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (typeof onTimerPress === 'function') {
      onTimerPress();
    }
  };

  return (
    <View style={styles.controlsContainer} testID="playback-controls">
      <TouchableOpacity
        onPress={handleVolumePress}
        style={styles.secondaryControlButton}
        testID="volume-shortcut-button"
        accessibilityLabel="Adjust volume"
      >
        <LinearGradient
          colors={['#7c4dff', '#4a148c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.secondaryControlGradient}
        >
          <Ionicons name="volume-high" size={28} color="#ffffff" />
        </LinearGradient>
      </TouchableOpacity>

      <Animated.View style={animatedButtonStyle}>
        <TouchableOpacity
          onPress={handlePlayPress}
          style={styles.mainPlayButton}
          testID="main-play-pause-button"
          accessibilityLabel={isPlaying ? "Pause playback" : "Start playback"}
        >
          <LinearGradient
            colors={['#7c4dff', '#4a148c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mainPlayGradient}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={56}
              color="#ffffff"
              style={!isPlaying && { marginLeft: 6 }}
            />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity
        onPress={handleTimerPress}
        style={styles.secondaryControlButton}
        testID="timer-shortcut-button"
        accessibilityLabel="Open timer"
      >
        <LinearGradient
          colors={['#7c4dff', '#4a148c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.secondaryControlGradient}
        >
          <Ionicons name="timer-outline" size={28} color="#ffffff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function SoundBadge({ sound, volume, onPress }) {
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(0.95, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    if (typeof onPress === 'function') {
      onPress(sound?.id);
    }
  };

  const volumePercentage = Math.round((volume || 0) * 100);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.soundBadge, { borderColor: sound?.color || '#7c4dff' }]}
        testID={`sound-badge-${sound?.id}`}
        accessibilityLabel={`${sound?.name || 'Sound'} at ${volumePercentage}% volume, tap to adjust`}
      >
        <BlurView intensity={80} tint="dark" style={styles.badgeBlur}>
          <View style={[styles.badgeIconContainer, { backgroundColor: (sound?.color || '#7c4dff') + '30' }]}>
            <Ionicons name={sound?.icon || 'musical-note'} size={20} color={sound?.color || '#7c4dff'} />
          </View>
          <View style={styles.badgeTextContainer}>
            <Text style={styles.badgeName} numberOfLines={1}>
              {sound?.name || 'Unknown'}
            </Text>
            <Text style={styles.badgeVolume}>{volumePercentage}%</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

function TimerDisplay({ remainingSeconds }) {
  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return null;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timeString = formatTime(remainingSeconds);

  if (!timeString) return null;

  return (
    <View style={styles.timerDisplayContainer} testID="timer-display">
      <BlurView intensity={60} tint="dark" style={styles.timerDisplayBlur}>
        <Ionicons name="timer" size={18} color="#7c4dff" />
        <Text style={styles.timerDisplayText}>{timeString}</Text>
      </BlurView>
    </View>
  );
}

export default function NowPlaying({ navigation }) {
  const {
    activeSounds,
    isPlaying,
    playSound,
    pauseSound,
    stopAll,
    timerRemaining,
    currentMix,
  } = useDreamDrift();

  const [showVolumeModal, setShowVolumeModal] = useState(false);

  const handlePlayPause = () => {
    if (isPlaying) {
      (activeSounds || []).forEach((sound) => {
        if (typeof pauseSound === 'function') {
          pauseSound(sound?.id);
        }
      });
    } else {
      (activeSounds || []).forEach((sound) => {
        if (typeof playSound === 'function') {
          playSound(sound?.id);
        }
      });
    }
  };

  const handleVolumePress = () => {
    setShowVolumeModal(true);
  };

  const handleTimerPress = () => {
    if (typeof navigation?.navigate === 'function') {
      navigation.navigate('Timer');
    }
  };

  const handleSoundBadgePress = (soundId) => {
    if (typeof navigation?.navigate === 'function') {
      navigation.navigate('Mix');
    }
  };

  const backgroundColors = useMemo(() => {
    const sounds = activeSounds || [];
    if (sounds.length === 0) {
      return ['#0a0e27', '#1a1f3a'];
    }
    if (sounds.length === 1) {
      const color = sounds[0]?.color || '#7c4dff';
      return [color + '40', '#0a0e27'];
    }
    const color1 = sounds[0]?.color || '#7c4dff';
    const color2 = sounds[1]?.color || '#4a148c';
    return [color1 + '40', color2 + '40', '#0a0e27'];
  }, [activeSounds]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={backgroundColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundGradient}
      >
        <BlurView intensity={100} tint="dark" style={styles.blurOverlay} testID="blur-background">
          <View style={styles.content}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (typeof navigation?.goBack === 'function') {
                    navigation.goBack();
                  }
                }}
                style={styles.backButton}
                testID="back-button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-down" size={32} color="#e8eaf6" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Now Playing</Text>
              <View style={styles.headerSpacer} />
            </View>

            {timerRemaining > 0 && <TimerDisplay remainingSeconds={timerRemaining} />}

            <View style={styles.visualizerWrapper}>
              <AudioVisualizer isPlaying={isPlaying} activeSounds={activeSounds} />
            </View>

            <View style={styles.soundBadgesContainer} testID="sound-badges">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.soundBadgesScroll}
              >
                {(activeSounds || []).map((sound) => (
                  <SoundBadge
                    key={sound?.id}
                    sound={sound}
                    volume={(currentMix?.volumes || {})[sound?.id] || 0.7}
                    onPress={handleSoundBadgePress}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.controlsWrapper}>
              <PlaybackControls
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onVolumePress={handleVolumePress}
                onTimerPress={handleTimerPress}
              />
            </View>

            {(activeSounds || []).length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="musical-notes-outline" size={80} color="#7c4dff" style={{ opacity: 0.3 }} />
                <Text style={styles.emptyStateTitle}>No sounds playing</Text>
                <Text style={styles.emptyStateSubtitle}>Add sounds from the library or mixer</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (typeof navigation?.navigate === 'function') {
                      navigation.navigate('Sounds');
                    }
                  }}
                  style={styles.emptyStateButton}
                  testID="browse-sounds-button"
                  accessibilityLabel="Browse sounds"
                >
                  <LinearGradient
                    colors={['#7c4dff', '#4a148c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emptyStateButtonGradient}
                  >
                    <Ionicons name="musical-notes" size={20} color="#ffffff" />
                    <Text style={styles.emptyStateButtonText}>Browse Sounds</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </BlurView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  backgroundGradient: {
    flex: 1,
  },
  blurOverlay: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e8eaf6',
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 44,
  },
  timerDisplayContainer: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  timerDisplayBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#7c4dff',
    overflow: 'hidden',
  },
  timerDisplayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaf6',
    marginLeft: 8,
  },
  visualizerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizerContainer: {
    width: width,
    height: height * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizerSvg: {
    position: 'absolute',
  },
  visualizerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualizerPlaceholderText: {
    fontSize: 16,
    color: '#e8eaf6',
    marginTop: 16,
    opacity: 0.5,
  },
  soundBadgesContainer: {
    marginBottom: 24,
  },
  soundBadgesScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  soundBadge: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    marginRight: 12,
  },
  badgeBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  badgeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTextContainer: {
    gap: 2,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e8eaf6',
    maxWidth: 100,
  },
  badgeVolume: {
    fontSize: 12,
    color: '#e8eaf6',
    opacity: 0.7,
  },
  controlsWrapper: {
    marginBottom: 40,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    paddingHorizontal: 20,
  },
  secondaryControlButton: {
    borderRadius: 32,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  secondaryControlGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainPlayButton: {
    borderRadius: 60,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  mainPlayGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    position: 'absolute',
    top: height * 0.3,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e8eaf6',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#e8eaf6',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  emptyStateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 10,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
