import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Switch,
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
import Svg, { Circle, Line } from 'react-native-svg';
import { formatDistanceToNow, format } from 'date-fns';
import { useDreamDrift } from '../context/DreamDriftContext';

const { width } = Dimensions.get('window');

const TIMER_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

const FADE_PRESETS = [
  { label: '1 min', value: 1 },
  { label: '3 min', value: 3 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
];

const THEME_OPTIONS = [
  { id: 'dark-blue', name: 'Dark Blue', colors: ['#0a0e27', '#1a1f3a'] },
  { id: 'purple', name: 'Purple Dream', colors: ['#4a148c', '#7c4dff'] },
];

function SectionHeader({ icon, title, testID }) {
  return (
    <View style={styles.sectionHeader} testID={testID}>
      <Ionicons name={icon} size={22} color="#7c4dff" />
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function VolumeSlider({ value, onValueChange, label, icon }) {
  const sliderScale = useSharedValue(1);
  const [localValue, setLocalValue] = useState(value);

  const animatedSliderStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sliderScale.value }],
  }));

  const handleTouchStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sliderScale.value = withSpring(1.05, { damping: 10 });
  };

  const handleTouchEnd = () => {
    sliderScale.value = withSpring(1, { damping: 10 });
    if (typeof onValueChange === 'function') {
      onValueChange(localValue);
    }
  };

  const handlePanResponderMove = (evt) => {
    const locationX = evt.nativeEvent.locationX;
    const sliderWidth = width - 120;
    const newValue = Math.max(0, Math.min(1, locationX / sliderWidth));
    setLocalValue(newValue);
  };

  const volumePercentage = Math.round(localValue * 100);

  return (
    <View style={styles.volumeSliderContainer}>
      <View style={styles.volumeSliderHeader}>
        <View style={styles.volumeSliderLabel}>
          <Ionicons name={icon} size={20} color="#e8eaf6" />
          <Text style={styles.volumeSliderLabelText}>{label}</Text>
        </View>
        <Text style={styles.volumeSliderValue}>{volumePercentage}%</Text>
      </View>
      <Animated.View
        style={[styles.sliderTrack, animatedSliderStyle]}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handlePanResponderMove}
      >
        <View
          style={[
            styles.sliderFill,
            {
              width: `${volumePercentage}%`,
            },
          ]}
        />
        <View
          style={[
            styles.sliderThumb,
            {
              left: `${volumePercentage}%`,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

function TimerPresetButton({ preset, isSelected, onPress }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(0.95, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    if (typeof onPress === 'function') {
      onPress(preset.value);
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.presetButton, isSelected && styles.presetButtonSelected]}
        onPress={handlePress}
        testID={`timer-preset-${preset.value}`}
        accessibilityLabel={`Set default timer to ${preset.label}`}
      >
        <Text style={[styles.presetButtonText, isSelected && styles.presetButtonTextSelected]}>
          {preset.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function StatsCard({ icon, label, value, color, testID }) {
  return (
    <View style={styles.statsCard} testID={testID}>
      <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View style={styles.statsContent}>
        <Text style={styles.statsValue}>{value}</Text>
        <Text style={styles.statsLabel}>{label}</Text>
      </View>
    </View>
  );
}

function SimpleBarChart({ sessions }) {
  const maxDuration = useMemo(() => {
    if (!sessions || sessions.length === 0) return 3600;
    return Math.max(...(sessions || []).map((s) => s?.duration ?? 0));
  }, [sessions]);

  const recentSessions = useMemo(() => {
    return (sessions || [])
      .sort((a, b) => (b?.completedAt ?? 0) - (a?.completedAt ?? 0))
      .slice(0, 7);
  }, [sessions]);

  const barWidth = (width - 80) / 7;
  const chartHeight = 120;

  return (
    <View style={styles.chartContainer} testID="session-stats-chart">
      <Svg width={width - 80} height={chartHeight}>
        {(recentSessions || []).map((session, index) => {
          const duration = session?.duration ?? 0;
          const barHeight = (duration / maxDuration) * (chartHeight - 20);
          const x = index * barWidth + barWidth / 4;
          const y = chartHeight - barHeight;

          return (
            <React.Fragment key={session?.id ?? index}>
              <Line
                x1={x}
                y1={chartHeight}
                x2={x}
                y2={y}
                stroke="#7c4dff"
                strokeWidth={barWidth / 2}
                strokeLinecap="round"
              />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.chartLabels}>
        {(recentSessions || []).map((session, index) => {
          const completedAt = session?.completedAt ?? Date.now();
          const dateObj = new Date(completedAt);
          const safeDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
          const dayLabel = format(safeDate, 'EEE').slice(0, 1);
          return (
            <Text key={session?.id ?? index} style={styles.chartLabel}>
              {dayLabel}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function ThemeOption({ theme, isSelected, onPress }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(0.95, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    if (typeof onPress === 'function') {
      onPress(theme.id);
    }
  };

  return (
    <Animated.View style={[styles.themeOption, animatedStyle]}>
      <TouchableOpacity
        style={[styles.themeButton, isSelected && styles.themeButtonSelected]}
        onPress={handlePress}
        testID={`theme-${theme.id}`}
        accessibilityLabel={`Switch to ${theme.name} theme`}
      >
        <LinearGradient
          colors={theme.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.themeGradient}
        >
          {isSelected && (
            <View style={styles.themeCheckmark}>
              <Ionicons name="checkmark-circle" size={28} color="#ffffff" />
            </View>
          )}
        </LinearGradient>
        <Text style={styles.themeName}>{theme.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ActionButton({ icon, label, onPress, color, testID }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    scale.value = withSequence(
      withSpring(0.95, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    if (typeof onPress === 'function') {
      onPress();
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.actionButton, { borderColor: color }]}
        onPress={handlePress}
        testID={testID}
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={24} color={color} />
        <Text style={[styles.actionButtonText, { color }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function Settings() {
  const {
    settings,
    updateSettings,
    sessions,
    clearAllData,
    clearSessions,
  } = useDreamDrift();

  const [localMasterVolume, setLocalMasterVolume] = useState(settings?.masterVolume ?? 0.8);
  const [localFadeOut, setLocalFadeOut] = useState(settings?.fadeOutDuration ?? 5);

  const totalSessions = useMemo(() => {
    return (sessions || []).length;
  }, [sessions]);

  const totalHoursSlept = useMemo(() => {
    const totalSeconds = (sessions || []).reduce((sum, session) => {
      return sum + (session?.duration ?? 0);
    }, 0);
    return (totalSeconds / 3600).toFixed(1);
  }, [sessions]);

  const handleMasterVolumeChange = (value) => {
    setLocalMasterVolume(value);
    if (typeof updateSettings === 'function') {
      updateSettings({ masterVolume: value });
    }
  };

  const handleFadeOutChange = (value) => {
    setLocalFadeOut(value);
    if (typeof updateSettings === 'function') {
      updateSettings({ fadeOutDuration: value });
    }
  };

  const handleDefaultTimerChange = (value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (typeof updateSettings === 'function') {
      updateSettings({ defaultTimer: value });
    }
  };

  const handleThemeChange = (themeId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (typeof updateSettings === 'function') {
      updateSettings({ theme: themeId });
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Session History',
      'This will delete all your session history. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (typeof clearSessions === 'function') {
              clearSessions();
            }
          },
        },
      ]
    );
  };

  const handleResetApp = () => {
    Alert.alert(
      'Reset All Data',
      'This will delete all your data including favorites, mixes, and sessions. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (typeof clearAllData === 'function') {
              clearAllData();
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#7c4dff', '#4a148c']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Customize your sleep experience</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader icon="volume-high" title="Volume Settings" testID="volume-settings-header" />
        <View style={styles.section} testID="volume-settings">
          <VolumeSlider
            value={localMasterVolume}
            onValueChange={handleMasterVolumeChange}
            label="Master Volume"
            icon="volume-medium"
          />
          <View style={styles.divider} />
          <View style={styles.fadeOutContainer}>
            <View style={styles.fadeOutHeader}>
              <View style={styles.fadeOutLabel}>
                <Ionicons name="contract" size={20} color="#e8eaf6" />
                <Text style={styles.fadeOutLabelText}>Fade-Out Duration</Text>
              </View>
              <Text style={styles.fadeOutValue}>{localFadeOut} min</Text>
            </View>
            <View style={styles.fadeOutPresets}>
              {(FADE_PRESETS || []).map((preset) => (
                <TouchableOpacity
                  key={preset.value}
                  style={[
                    styles.fadePresetButton,
                    localFadeOut === preset.value && styles.fadePresetButtonSelected,
                  ]}
                  onPress={() => handleFadeOutChange(preset.value)}
                  testID={`fade-preset-${preset.value}`}
                  accessibilityLabel={`Set fade-out to ${preset.label}`}
                >
                  <Text
                    style={[
                      styles.fadePresetText,
                      localFadeOut === preset.value && styles.fadePresetTextSelected,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <SectionHeader icon="timer" title="Timer Defaults" testID="timer-defaults-header" />
        <View style={styles.section} testID="timer-defaults">
          <Text style={styles.sectionDescription}>
            Set your preferred default timer duration for quick starts
          </Text>
          <View style={styles.timerPresets}>
            {(TIMER_PRESETS || []).map((preset) => (
              <TimerPresetButton
                key={preset.value}
                preset={preset}
                isSelected={(settings?.defaultTimer ?? 30) === preset.value}
                onPress={handleDefaultTimerChange}
              />
            ))}
          </View>
        </View>

        <SectionHeader icon="stats-chart" title="Session Statistics" testID="session-stats-header" />
        <View style={styles.section} testID="session-stats">
          <View style={styles.statsGrid}>
            <StatsCard
              icon="moon"
              label="Total Sessions"
              value={totalSessions.toString()}
              color="#7c4dff"
              testID="stats-sessions"
            />
            <StatsCard
              icon="time"
              label="Hours Slept"
              value={totalHoursSlept}
              color="#4a148c"
              testID="stats-hours"
            />
          </View>
          {(sessions || []).length > 0 ? (
            <>
              <Text style={styles.chartTitle}>Last 7 Sessions</Text>
              <SimpleBarChart sessions={sessions} />
            </>
          ) : (
            <View style={styles.emptyStats}>
              <Ionicons name="moon-outline" size={48} color="#7c4dff40" />
              <Text style={styles.emptyStatsText}>No sessions yet</Text>
              <Text style={styles.emptyStatsSubtext}>
                Start using the timer to track your sleep sessions
              </Text>
            </View>
          )}
        </View>

        <SectionHeader icon="color-palette" title="Theme" testID="theme-toggle-header" />
        <View style={styles.section} testID="theme-toggle">
          <View style={styles.themeOptions}>
            {(THEME_OPTIONS || []).map((theme) => (
              <ThemeOption
                key={theme.id}
                theme={theme}
                isSelected={(settings?.theme ?? 'dark-blue') === theme.id}
                onPress={handleThemeChange}
              />
            ))}
          </View>
        </View>

        <SectionHeader icon="trash" title="Data Management" testID="data-management-header" />
        <View style={styles.section} testID="data-management">
          <ActionButton
            icon="trash-outline"
            label="Clear Session History"
            onPress={handleClearHistory}
            color="#ff9800"
            testID="clear-history-button"
          />
          <View style={styles.actionButtonSpacer} />
          <ActionButton
            icon="refresh"
            label="Reset All App Data"
            onPress={handleResetApp}
            color="#f44336"
            testID="reset-app-button"
          />
        </View>

        <View style={styles.footer}>
          <Ionicons name="moon" size={24} color="#7c4dff40" />
          <Text style={styles.footerText}>DreamDrift v1.0.0</Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e8eaf6',
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e8eaf6',
    marginLeft: 10,
  },
  section: {
    backgroundColor: '#1a1f3a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#e8eaf6',
    opacity: 0.7,
    marginBottom: 16,
    lineHeight: 20,
  },
  volumeSliderContainer: {
    marginBottom: 8,
  },
  volumeSliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  volumeSliderLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  volumeSliderLabelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaf6',
    marginLeft: 8,
  },
  volumeSliderValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7c4dff',
  },
  sliderTrack: {
    height: 8,
    backgroundColor: '#0a0e27',
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#7c4dff',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7c4dff',
    marginLeft: -10,
    shadowColor: '#7c4dff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#0a0e27',
    marginVertical: 20,
  },
  fadeOutContainer: {
    marginTop: 8,
  },
  fadeOutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fadeOutLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fadeOutLabelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaf6',
    marginLeft: 8,
  },
  fadeOutValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7c4dff',
  },
  fadeOutPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fadePresetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0a0e27',
    borderWidth: 1,
    borderColor: '#0a0e27',
  },
  fadePresetButtonSelected: {
    backgroundColor: '#7c4dff20',
    borderColor: '#7c4dff',
  },
  fadePresetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e8eaf6',
  },
  fadePresetTextSelected: {
    color: '#7c4dff',
  },
  timerPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetButton: {
    flex: 1,
    minWidth: (width - 80) / 2 - 6,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#0a0e27',
    borderWidth: 2,
    borderColor: '#0a0e27',
    alignItems: 'center',
  },
  presetButtonSelected: {
    backgroundColor: '#7c4dff20',
    borderColor: '#7c4dff',
  },
  presetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaf6',
  },
  presetButtonTextSelected: {
    color: '#7c4dff',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statsCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0e27',
    borderRadius: 12,
    padding: 16,
  },
  statsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statsContent: {
    flex: 1,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e8eaf6',
    marginBottom: 2,
  },
  statsLabel: {
    fontSize: 12,
    color: '#e8eaf6',
    opacity: 0.6,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e8eaf6',
    marginBottom: 12,
    opacity: 0.8,
  },
  chartContainer: {
    alignItems: 'center',
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width - 80,
    marginTop: 8,
  },
  chartLabel: {
    fontSize: 12,
    color: '#e8eaf6',
    opacity: 0.5,
  },
  emptyStats: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStatsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaf6',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStatsSubtext: {
    fontSize: 14,
    color: '#e8eaf6',
    opacity: 0.5,
    textAlign: 'center',
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 16,
  },
  themeOption: {
    flex: 1,
  },
  themeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeButtonSelected: {
    borderColor: '#7c4dff',
  },
  themeGradient: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  themeCheckmark: {
    position: 'absolute',
  },
  themeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e8eaf6',
    textAlign: 'center',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  actionButtonSpacer: {
    height: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#e8eaf6',
    opacity: 0.4,
    marginLeft: 8,
  },
});
