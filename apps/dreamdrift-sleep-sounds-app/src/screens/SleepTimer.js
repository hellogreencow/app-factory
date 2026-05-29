import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useDreamDrift } from '../context/DreamDriftContext';

const { width, height } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(width, height) * 0.55;
const CIRCLE_RADIUS = (CIRCLE_SIZE - 40) / 2;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const TIME_PRESETS = [
  { label: '15 min', value: 15, icon: 'time-outline' },
  { label: '30 min', value: 30, icon: 'time' },
  { label: '45 min', value: 45, icon: 'time' },
  { label: '60 min', value: 60, icon: 'timer' },
];

function CircularTimer({ totalSeconds, remainingSeconds, isActive }) {
  const rotation = useSharedValue(0);
  const progress = remainingSeconds / Math.max(totalSeconds, 1);
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress);

  useEffect(() => {
    if (isActive) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = withTiming(0, { duration: 300 });
    }
  }, [isActive]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: isActive ? 0.6 : 0.3,
  }));

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.circularTimerContainer} testID="circular-timer">
      <Animated.View style={[styles.glowCircle, animatedGlowStyle]}>
        <LinearGradient
          colors={['#7c4dff', '#4a148c', '#7c4dff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glowGradient}
        />
      </Animated.View>
      
      <View style={styles.svgContainer}>
        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={CIRCLE_RADIUS}
            stroke="#12162b"
            strokeWidth={12}
            fill="none"
          />
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={CIRCLE_RADIUS}
            stroke="url(#gradient)"
            strokeWidth={12}
            fill="none"
            strokeDasharray={CIRCLE_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
          />
        </Svg>
        
        <View style={styles.timerTextContainer}>
          <Text style={styles.timerText} testID="timer-display">
            {formatTime(remainingSeconds)}
          </Text>
          <Text style={styles.timerSubtext}>
            {isActive ? 'remaining' : 'until sleep'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PresetButton({ preset, isSelected, onPress }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.9, { damping: 10 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
    onPress?.();
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.presetButton, isSelected && styles.presetButtonSelected]}
        testID={`preset-${preset.value}`}
        accessibilityLabel={`Set timer to ${preset.label}`}
      >
        <Ionicons
          name={preset.icon}
          size={24}
          color={isSelected ? '#7c4dff' : '#e8eaf6'}
        />
        <Text style={[styles.presetLabel, isSelected && styles.presetLabelSelected]}>
          {preset.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function CustomTimePicker({ visible, onClose, onConfirm, initialMinutes }) {
  const [hours, setHours] = useState(Math.floor((initialMinutes || 0) / 60));
  const [minutes, setMinutes] = useState((initialMinutes || 0) % 60);

  const handleConfirm = () => {
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onConfirm?.(totalMinutes);
      onClose?.();
    } else {
      Alert.alert('Invalid Time', 'Please set a time greater than 0 minutes.');
    }
  };

  const adjustValue = (type, delta) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'hours') {
      setHours(Math.max(0, Math.min(23, hours + delta)));
    } else {
      setMinutes(Math.max(0, Math.min(59, minutes + delta)));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Custom Timer</Text>
            <TouchableOpacity
              onPress={onClose}
              testID="close-custom-picker"
              accessibilityLabel="Close custom time picker"
            >
              <Ionicons name="close" size={28} color="#e8eaf6" />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerContainer}>
            <View style={styles.pickerColumn}>
              <TouchableOpacity
                onPress={() => adjustValue('hours', 1)}
                style={styles.pickerButton}
                testID="hours-increment"
              >
                <Ionicons name="chevron-up" size={32} color="#7c4dff" />
              </TouchableOpacity>
              <View style={styles.pickerValue}>
                <TextInput
                  style={styles.pickerInput}
                  value={hours.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 0 && num <= 23) {
                      setHours(num);
                    } else if (text === '') {
                      setHours(0);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  testID="hours-input"
                />
                <Text style={styles.pickerLabel}>hours</Text>
              </View>
              <TouchableOpacity
                onPress={() => adjustValue('hours', -1)}
                style={styles.pickerButton}
                testID="hours-decrement"
              >
                <Ionicons name="chevron-down" size={32} color="#7c4dff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.pickerSeparator}>:</Text>

            <View style={styles.pickerColumn}>
              <TouchableOpacity
                onPress={() => adjustValue('minutes', 1)}
                style={styles.pickerButton}
                testID="minutes-increment"
              >
                <Ionicons name="chevron-up" size={32} color="#7c4dff" />
              </TouchableOpacity>
              <View style={styles.pickerValue}>
                <TextInput
                  style={styles.pickerInput}
                  value={minutes.toString().padStart(2, '0')}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 0 && num <= 59) {
                      setMinutes(num);
                    } else if (text === '') {
                      setMinutes(0);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  testID="minutes-input"
                />
                <Text style={styles.pickerLabel}>minutes</Text>
              </View>
              <TouchableOpacity
                onPress={() => adjustValue('minutes', -1)}
                style={styles.pickerButton}
                testID="minutes-decrement"
              >
                <Ionicons name="chevron-down" size={32} color="#7c4dff" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleConfirm}
            style={styles.confirmButton}
            testID="confirm-custom-time"
            accessibilityLabel="Confirm custom time"
          >
            <LinearGradient
              colors={['#7c4dff', '#4a148c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGradient}
            >
              <Text style={styles.confirmButtonText}>Set Timer</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function FadeOutControl({ enabled, duration, onToggle, onDurationChange }) {
  const [localDuration, setLocalDuration] = useState(duration);
  const toggleScale = useSharedValue(1);

  const animatedToggleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: toggleScale.value }],
  }));

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleScale.value = withSpring(0.9, { damping: 10 }, () => {
      toggleScale.value = withSpring(1, { damping: 10 });
    });
    onToggle?.();
  };

  const handleDurationChange = (value) => {
    setLocalDuration(value);
  };

  const handleDurationComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDurationChange?.(localDuration);
  };

  const fadePercentage = Math.round((localDuration / 600) * 100);

  return (
    <View style={styles.fadeOutContainer} testID="fade-out-control">
      <View style={styles.fadeOutHeader}>
        <View style={styles.fadeOutTitleRow}>
          <Ionicons name="volume-low" size={24} color="#7c4dff" />
          <Text style={styles.fadeOutTitle}>Fade Out</Text>
        </View>
        <Animated.View style={animatedToggleStyle}>
          <TouchableOpacity
            onPress={handleToggle}
            style={[styles.toggle, enabled && styles.toggleActive]}
            testID="fade-out-toggle"
            accessibilityLabel={`${enabled ? 'Disable' : 'Enable'} fade out`}
          >
            <View style={[styles.toggleThumb, enabled && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {enabled && (
        <View style={styles.fadeOutSliderContainer}>
          <Text style={styles.fadeOutLabel}>
            Fade duration: {Math.floor(localDuration / 60)}:{(localDuration % 60).toString().padStart(2, '0')}
          </Text>
          <View style={styles.sliderWrapper}>
            <View style={styles.sliderTrack}>
              <View
                style={[
                  styles.sliderFill,
                  { width: `${fadePercentage}%` },
                ]}
              />
              <View
                style={[
                  styles.sliderThumb,
                  { left: `${fadePercentage}%` },
                ]}
                onTouchStart={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                onTouchEnd={handleDurationComplete}
              />
            </View>
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabelText}>0:30</Text>
            <Text style={styles.sliderLabelText}>10:00</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function TimerControls({ isActive, isPaused, onStart, onPause, onResume, onReset }) {
  const playScale = useSharedValue(1);
  const resetScale = useSharedValue(1);

  const animatedPlayStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playScale.value }],
  }));

  const animatedResetStyle = useAnimatedStyle(() => ({
    transform: [{ scale: resetScale.value }],
  }));

  const handlePlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    playScale.value = withSpring(0.85, { damping: 10 }, () => {
      playScale.value = withSpring(1, { damping: 10 });
    });

    if (!isActive) {
      onStart?.();
    } else if (isPaused) {
      onResume?.();
    } else {
      onPause?.();
    }
  };

  const handleResetPress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resetScale.value = withSpring(0.85, { damping: 10 }, () => {
      resetScale.value = withSpring(1, { damping: 10 });
    });
    onReset?.();
  };

  const getPlayIcon = () => {
    if (!isActive) return 'play';
    if (isPaused) return 'play';
    return 'pause';
  };

  return (
    <View style={styles.controlsContainer} testID="timer-controls">
      <Animated.View style={animatedPlayStyle}>
        <TouchableOpacity
          onPress={handlePlayPress}
          style={styles.playButton}
          testID="timer-play-pause"
          accessibilityLabel={!isActive ? 'Start timer' : isPaused ? 'Resume timer' : 'Pause timer'}
        >
          <LinearGradient
            colors={['#7c4dff', '#4a148c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.playGradient}
          >
            <Ionicons name={getPlayIcon()} size={48} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {isActive && (
        <Animated.View style={animatedResetStyle}>
          <TouchableOpacity
            onPress={handleResetPress}
            style={styles.resetButton}
            testID="timer-reset"
            accessibilityLabel="Reset timer"
          >
            <Ionicons name="refresh" size={32} color="#e8eaf6" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

export default function SleepTimer() {
  const { startTimer, stopTimer, timerRemaining, settings, updateSettings } = useDreamDrift();
  
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [fadeOutEnabled, setFadeOutEnabled] = useState(true);
  const [fadeOutDuration, setFadeOutDuration] = useState((settings?.fadeOutDuration ?? 300));

  const intervalRef = useRef(null);

  useEffect(() => {
    const defaultTimer = settings?.defaultTimer ?? 30;
    setCustomMinutes(defaultTimer);
    setTotalSeconds(defaultTimer * 60);
    setRemainingSeconds(defaultTimer * 60);
  }, [settings]);

  useEffect(() => {
    if (isActive && !isPaused) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, isPaused]);

  const handleTimerComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsActive(false);
    setIsPaused(false);
    stopTimer?.();
    Alert.alert('Rest well', 'The night is still yours.');
  };

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.value);
    const seconds = preset.value * 60;
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    setIsActive(false);
    setIsPaused(false);
  };

  const handleCustomTimeConfirm = (minutes) => {
    setSelectedPreset(null);
    setCustomMinutes(minutes);
    const seconds = minutes * 60;
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    setIsActive(false);
    setIsPaused(false);
  };

  const handleStart = () => {
    if (totalSeconds > 0) {
      setIsActive(true);
      setIsPaused(false);
      startTimer?.(totalSeconds, fadeOutEnabled ? fadeOutDuration : 0);
    } else {
      Alert.alert('No Time Set', 'Please select a timer duration first.');
    }
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleReset = () => {
    setIsActive(false);
    setIsPaused(false);
    setRemainingSeconds(totalSeconds);
    stopTimer?.();
  };

  const handleFadeOutToggle = () => {
    setFadeOutEnabled(!fadeOutEnabled);
  };

  const handleFadeOutDurationChange = (duration) => {
    setFadeOutDuration(duration);
    updateSettings?.({ fadeOutDuration: duration });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0e27', '#1a1f3a']}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Ionicons name="timer" size={32} color="#7c4dff" />
            <Text style={styles.headerTitle}>Sleep Timer</Text>
          </View>

          <CircularTimer
            totalSeconds={totalSeconds}
            remainingSeconds={remainingSeconds}
            isActive={isActive && !isPaused}
          />

          <TimerControls
            isActive={isActive}
            isPaused={isPaused}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onReset={handleReset}
          />

          <View style={styles.presetsSection}>
            <Text style={styles.sectionTitle}>Quick Presets</Text>
            <View style={styles.presetsGrid}>
              {(TIME_PRESETS || []).map((preset) => (
                <PresetButton
                  key={preset.value}
                  preset={preset}
                  isSelected={selectedPreset === preset.value}
                  onPress={() => handlePresetSelect(preset)}
                />
              ))}
            </View>
          </View>

          <View style={styles.customSection}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCustomPicker(true);
              }}
              style={styles.customButton}
              testID="open-custom-picker"
              accessibilityLabel="Open custom time picker"
            >
              <Ionicons name="create-outline" size={24} color="#7c4dff" />
              <Text style={styles.customButtonText}>Custom Time</Text>
              <Ionicons name="chevron-forward" size={24} color="#e8eaf6" />
            </TouchableOpacity>
          </View>

          <FadeOutControl
            enabled={fadeOutEnabled}
            duration={fadeOutDuration}
            onToggle={handleFadeOutToggle}
            onDurationChange={handleFadeOutDurationChange}
          />

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </LinearGradient>

      <CustomTimePicker
        visible={showCustomPicker}
        onClose={() => setShowCustomPicker(false)}
        onConfirm={handleCustomTimeConfirm}
        initialMinutes={customMinutes}
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e8eaf6',
  },
  circularTimerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
    position: 'relative',
  },
  glowCircle: {
    position: 'absolute',
    width: CIRCLE_SIZE + 40,
    height: CIRCLE_SIZE + 40,
    borderRadius: (CIRCLE_SIZE + 40) / 2,
    overflow: 'hidden',
  },
  glowGradient: {
    flex: 1,
    opacity: 0.3,
  },
  svgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 56,
    fontWeight: '700',
    color: '#e8eaf6',
    letterSpacing: 2,
  },
  timerSubtext: {
    fontSize: 16,
    color: '#e8eaf6',
    opacity: 0.6,
    marginTop: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginVertical: 20,
  },
  playButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  playGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a1f3a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#7c4dff',
  },
  presetsSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e8eaf6',
    marginBottom: 16,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetButton: {
    flex: 1,
    minWidth: (width - 52) / 2,
    backgroundColor: '#1a1f3a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetButtonSelected: {
    borderColor: '#7c4dff',
    backgroundColor: '#7c4dff20',
  },
  presetLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaf6',
  },
  presetLabelSelected: {
    color: '#7c4dff',
  },
  customSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f3a',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 2,
    borderColor: '#7c4dff40',
  },
  customButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaf6',
  },
  fadeOutContainer: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#1a1f3a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#7c4dff20',
  },
  fadeOutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fadeOutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fadeOutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e8eaf6',
  },
  toggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0a0e27',
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#7c4dff',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e8eaf6',
    transform: [{ translateX: 0 }],
  },
  toggleThumbActive: {
    transform: [{ translateX: 24 }],
  },
  fadeOutSliderContainer: {
    marginTop: 20,
  },
  fadeOutLabel: {
    fontSize: 14,
    color: '#e8eaf6',
    opacity: 0.8,
    marginBottom: 12,
  },
  sliderWrapper: {
    paddingVertical: 8,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#0a0e27',
    borderRadius: 3,
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 6,
    backgroundColor: '#7c4dff',
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7c4dff',
    marginLeft: -10,
    elevation: 4,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 12,
    color: '#e8eaf6',
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 39, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1a1f3a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: '#7c4dff40',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e8eaf6',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
  },
  pickerColumn: {
    alignItems: 'center',
    gap: 16,
  },
  pickerButton: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0e27',
    borderRadius: 12,
  },
  pickerValue: {
    alignItems: 'center',
    gap: 8,
  },
  pickerInput: {
    fontSize: 48,
    fontWeight: '700',
    color: '#e8eaf6',
    textAlign: 'center',
    minWidth: 80,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#e8eaf6',
    opacity: 0.6,
  },
  pickerSeparator: {
    fontSize: 48,
    fontWeight: '700',
    color: '#e8eaf6',
    marginTop: -40,
  },
  confirmButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  bottomSpacer: {
    height: 40,
  },
});
