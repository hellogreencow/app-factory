import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusFlow } from '../context/FocusFlowContext';

const { width, height } = Dimensions.get('window');

const ONBOARDING_COMPLETE_KEY = '@focusflow_onboarding_complete';

const SLIDES = [
  {
    id: 'welcome',
    title: 'Welcome to FocusFlow',
    description: 'Master your productivity with the Pomodoro Technique. Work in focused intervals, take breaks, and achieve more.',
    icon: 'rocket',
    gradient: ['#6366f1', '#8b5cf6'],
  },
  {
    id: 'work',
    title: 'Focus Sessions',
    description: 'Work in 25-minute intervals of deep, uninterrupted focus. Each session helps you build momentum and accomplish your goals.',
    icon: 'briefcase',
    gradient: ['#6366f1', '#4f46e5'],
  },
  {
    id: 'break',
    title: 'Take Breaks',
    description: 'Rest is essential. Take short 5-minute breaks between sessions to recharge, and longer 15-minute breaks after every 4 sessions.',
    icon: 'cafe',
    gradient: ['#10b981', '#059669'],
  },
  {
    id: 'benefits',
    title: 'Track Your Progress',
    description: 'Monitor your productivity with detailed statistics, session history, and streak tracking. Watch yourself improve over time.',
    icon: 'stats-chart',
    gradient: ['#8b5cf6', '#a855f7'],
  },
  {
    id: 'setup',
    title: 'Quick Setup',
    description: 'Customize your timer preferences to match your workflow. You can always change these later in Settings.',
    icon: 'settings',
    gradient: ['#6366f1', '#8b5cf6'],
  },
];

export default function OnboardingScreen({ navigation }) {
  const { settings, updateSettings, theme } = useFocusFlow();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef(null);

  const safeTheme = theme ?? {
    backgroundColor: '#0f0f1a',
    textColor: '#e0e0e8',
    accentColor: '#6366f1',
    cardColor: '#1a1a2e',
    secondaryAccent: '#8b5cf6',
    borderRadius: 16,
  };

  const safeSettings = settings ?? {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsUntilLongBreak: 4,
    autoStartBreaks: false,
    autoStartWork: false,
    soundEnabled: true,
    hapticsEnabled: true,
  };

  const [localWorkDuration, setLocalWorkDuration] = useState(safeSettings.workDuration ?? 25);
  const [localShortBreakDuration, setLocalShortBreakDuration] = useState(safeSettings.shortBreakDuration ?? 5);
  const [localLongBreakDuration, setLocalLongBreakDuration] = useState(safeSettings.longBreakDuration ?? 15);

  const iconScale = useSharedValue(1);
  const iconRotate = useSharedValue(0);

  useEffect(() => {
    iconScale.value = withSpring(1.1, { damping: 8, stiffness: 100 });
    iconRotate.value = withTiming(360, { duration: 800 });

    const timeout = setTimeout(() => {
      iconScale.value = withSpring(1, { damping: 8, stiffness: 100 });
      iconRotate.value = withTiming(0, { duration: 0 });
    }, 800);

    return () => clearTimeout(timeout);
  }, [currentSlide]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: iconScale.value },
        { rotate: `${iconRotate.value}deg` },
      ],
    };
  });

  const handleNext = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (currentSlide < SLIDES.length - 1) {
      const nextSlide = currentSlide + 1;
      setCurrentSlide(nextSlide);
      scrollViewRef.current?.scrollTo({
        x: nextSlide * width,
        animated: true,
      });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      if (currentSlide === SLIDES.length - 1) {
        if (typeof updateSettings === 'function') {
          updateSettings({
            workDuration: localWorkDuration,
            shortBreakDuration: localShortBreakDuration,
            longBreakDuration: localLongBreakDuration,
          });
        }
      }

      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');

      if (typeof Haptics?.notificationAsync === 'function') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (navigation?.navigate) {
        navigation.navigate('Timer');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const handleDotPress = (index) => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCurrentSlide(index);
    scrollViewRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    if (index !== currentSlide && index >= 0 && index < SLIDES.length) {
      setCurrentSlide(index);
    }
  };

  const handleWorkDurationChange = (delta) => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.max(5, Math.min(60, localWorkDuration + delta));
    setLocalWorkDuration(newValue);
  };

  const handleShortBreakDurationChange = (delta) => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.max(1, Math.min(15, localShortBreakDuration + delta));
    setLocalShortBreakDuration(newValue);
  };

  const handleLongBreakDurationChange = (delta) => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.max(5, Math.min(30, localLongBreakDuration + delta));
    setLocalLongBreakDuration(newValue);
  };

  const renderSlide = (slide, index) => {
    const isSetupSlide = slide.id === 'setup';

    return (
      <View
        key={slide.id}
        style={[styles.slide, { width }]}
        testID={`onboarding-slide-${slide.id}`}
        accessibilityLabel={`Onboarding slide ${index + 1} of ${SLIDES.length}: ${slide.title}`}
      >
        <LinearGradient
          colors={slide.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        >
          <View style={styles.slideContent}>
            <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
              <Ionicons
                name={slide.icon}
                size={120}
                color="#ffffff"
                testID={`onboarding-icon-${slide.id}`}
              />
            </Animated.View>

            <Text
              style={styles.slideTitle}
              testID={`onboarding-title-${slide.id}`}
            >
              {slide.title}
            </Text>

            <Text
              style={styles.slideDescription}
              testID={`onboarding-description-${slide.id}`}
            >
              {slide.description}
            </Text>

            {isSetupSlide && (
              <View style={styles.setupContainer}>
                <View style={styles.setupCard}>
                  <View style={styles.setupRow}>
                    <View style={styles.setupLabelContainer}>
                      <Ionicons name="briefcase" size={20} color="#6366f1" />
                      <Text style={styles.setupLabel}>Work Duration</Text>
                    </View>
                    <View style={styles.setupControls}>
                      <TouchableOpacity
                        style={styles.setupButton}
                        onPress={() => handleWorkDurationChange(-5)}
                        testID="onboarding-work-duration-decrease"
                        accessibilityLabel="Decrease work duration"
                      >
                        <Ionicons name="remove" size={20} color="#ffffff" />
                      </TouchableOpacity>
                      <Text style={styles.setupValue}>{localWorkDuration}m</Text>
                      <TouchableOpacity
                        style={styles.setupButton}
                        onPress={() => handleWorkDurationChange(5)}
                        testID="onboarding-work-duration-increase"
                        accessibilityLabel="Increase work duration"
                      >
                        <Ionicons name="add" size={20} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.setupRow}>
                    <View style={styles.setupLabelContainer}>
                      <Ionicons name="cafe" size={20} color="#10b981" />
                      <Text style={styles.setupLabel}>Short Break</Text>
                    </View>
                    <View style={styles.setupControls}>
                      <TouchableOpacity
                        style={styles.setupButton}
                        onPress={() => handleShortBreakDurationChange(-1)}
                        testID="onboarding-short-break-decrease"
                        accessibilityLabel="Decrease short break duration"
                      >
                        <Ionicons name="remove" size={20} color="#ffffff" />
                      </TouchableOpacity>
                      <Text style={styles.setupValue}>{localShortBreakDuration}m</Text>
                      <TouchableOpacity
                        style={styles.setupButton}
                        onPress={() => handleShortBreakDurationChange(1)}
                        testID="onboarding-short-break-increase"
                        accessibilityLabel="Increase short break duration"
                      >
                        <Ionicons name="add" size={20} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.setupRow}>
                    <View style={styles.setupLabelContainer}>
                      <Ionicons name="moon" size={20} color="#8b5cf6" />
                      <Text style={styles.setupLabel}>Long Break</Text>
                    </View>
                    <View style={styles.setupControls}>
                      <TouchableOpacity
                        style={styles.setupButton}
                        onPress={() => handleLongBreakDurationChange(-5)}
                        testID="onboarding-long-break-decrease"
                        accessibilityLabel="Decrease long break duration"
                      >
                        <Ionicons name="remove" size={20} color="#ffffff" />
                      </TouchableOpacity>
                      <Text style={styles.setupValue}>{localLongBreakDuration}m</Text>
                      <TouchableOpacity
                        style={styles.setupButton}
                        onPress={() => handleLongBreakDurationChange(5)}
                        testID="onboarding-long-break-increase"
                        accessibilityLabel="Increase long break duration"
                      >
                        <Ionicons name="add" size={20} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: safeTheme.backgroundColor }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        testID="onboarding-scroll-view"
        accessibilityLabel="Swipeable onboarding slides"
      >
        {(SLIDES || []).map((slide, index) => renderSlide(slide, index))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dotsContainer}>
          {(SLIDES || []).map((slide, index) => {
            const isActive = index === currentSlide;
            return (
              <TouchableOpacity
                key={slide.id}
                style={[
                  styles.dot,
                  isActive && styles.dotActive,
                  { backgroundColor: isActive ? '#ffffff' : '#ffffff40' },
                ]}
                onPress={() => handleDotPress(index)}
                testID={`onboarding-dot-${index}`}
                accessibilityLabel={`Go to slide ${index + 1}`}
                accessibilityRole="button"
              />
            );
          })}
        </View>

        <View style={styles.buttonsContainer}>
          {currentSlide < SLIDES.length - 1 ? (
            <>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                testID="onboarding-skip-button"
                accessibilityLabel="Skip onboarding"
                accessibilityRole="button"
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext}
                testID="onboarding-next-button"
                accessibilityLabel="Next slide"
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextButtonGradient}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                  <Ionicons name="arrow-forward" size={20} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={handleComplete}
              testID="onboarding-get-started-button"
              accessibilityLabel="Get started with FocusFlow"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.getStartedButtonGradient}
              >
                <Text style={styles.getStartedButtonText}>Get Started</Text>
                <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    height: height,
  },
  gradientBackground: {
    flex: 1,
    paddingTop: 80,
    paddingBottom: 160,
    paddingHorizontal: 24,
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  slideDescription: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 32,
    opacity: 0.9,
  },
  setupContainer: {
    marginTop: 32,
    width: '100%',
  },
  setupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  setupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setupLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setupLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  setupControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setupButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  setupValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    minWidth: 48,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  skipButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    opacity: 0.7,
  },
  nextButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  getStartedButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  getStartedButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 12,
  },
  getStartedButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
