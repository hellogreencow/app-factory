import React, { useState } from 'react';
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
import { useFocusFlow } from '../context/FocusFlowContext';

const { width } = Dimensions.get('window');

export default function SettingsScreen() {
  const { settings, updateSettings, resetAllData, theme } = useFocusFlow();

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
  const [localSessionsUntilLongBreak, setLocalSessionsUntilLongBreak] = useState(safeSettings.sessionsUntilLongBreak ?? 4);

  const handleWorkDurationIncrease = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.min(localWorkDuration + 5, 60);
    setLocalWorkDuration(newValue);
    if (typeof updateSettings === 'function') {
      updateSettings({ workDuration: newValue });
    }
  };

  const handleWorkDurationDecrease = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.max(localWorkDuration - 5, 5);
    setLocalWorkDuration(newValue);
    if (typeof updateSettings === 'function') {
      updateSettings({ workDuration: newValue });
    }
  };

  const handleShortBreakDurationIncrease = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.min(localShortBreakDuration + 1, 15);
    setLocalShortBreakDuration(newValue);
    if (typeof updateSettings === 'function') {
      updateSettings({ shortBreakDuration: newValue });
    }
  };

  const handleShortBreakDurationDecrease = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.max(localShortBreakDuration - 1, 1);
    setLocalShortBreakDuration(newValue);
    if (typeof updateSettings === 'function') {
      updateSettings({ shortBreakDuration: newValue });
    }
  };

  const handleLongBreakDurationIncrease = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.min(localLongBreakDuration + 5, 60);
    setLocalLongBreakDuration(newValue);
    if (typeof updateSettings === 'function') {
      updateSettings({ longBreakDuration: newValue });
    }
  };

  const handleLongBreakDurationDecrease = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.max(localLongBreakDuration - 5, 5);
    setLocalLongBreakDuration(newValue);
    if (typeof updateSettings === 'function') {
      updateSettings({ longBreakDuration: newValue });
    }
  };

  const handleSessionsUntilLongBreakIncrease = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.min(localSessionsUntilLongBreak + 1, 10);
    setLocalSessionsUntilLongBreak(newValue);
    if (typeof updateSettings === 'function') {
      updateSettings({ sessionsUntilLongBreak: newValue });
    }
  };

  const handleSessionsUntilLongBreakDecrease = () => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = Math.max(localSessionsUntilLongBreak - 1, 2);
    setLocalSessionsUntilLongBreak(newValue);
    if (typeof updateSettings === 'function') {
      updateSettings({ sessionsUntilLongBreak: newValue });
    }
  };

  const handleToggleAutoStartBreaks = (value) => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (typeof updateSettings === 'function') {
      updateSettings({ autoStartBreaks: value });
    }
  };

  const handleToggleAutoStartWork = (value) => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (typeof updateSettings === 'function') {
      updateSettings({ autoStartWork: value });
    }
  };

  const handleToggleSound = (value) => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (typeof updateSettings === 'function') {
      updateSettings({ soundEnabled: value });
    }
  };

  const handleToggleHaptics = (value) => {
    if (typeof updateSettings === 'function') {
      updateSettings({ hapticsEnabled: value });
    }
  };

  const handleResetStats = () => {
    if (typeof Haptics?.notificationAsync === 'function') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    Alert.alert(
      'Reset All Data',
      'This will permanently delete all session history and reset your statistics. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            if (typeof Haptics?.impactAsync === 'function') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (typeof Haptics?.notificationAsync === 'function') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            if (typeof resetAllData === 'function') {
              resetAllData();
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: safeTheme.backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="settings" size={32} color={safeTheme.accentColor} />
          <Text style={[styles.headerTitle, { color: safeTheme.textColor }]}>Settings</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="timer" size={20} color={safeTheme.accentColor} />
            <Text style={[styles.sectionTitle, { color: safeTheme.textColor }]}>Timer Durations</Text>
          </View>

          <View style={[styles.card, { backgroundColor: safeTheme.cardColor }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="briefcase" size={20} color={safeTheme.accentColor} />
                <Text style={[styles.settingText, { color: safeTheme.textColor }]}>Work Duration</Text>
              </View>
              <View style={styles.durationControl}>
                <TouchableOpacity
                  onPress={handleWorkDurationDecrease}
                  style={[styles.controlButton, { borderColor: safeTheme.accentColor }]}
                  testID="work-duration-decrease"
                  accessibilityLabel="Decrease work duration"
                >
                  <Ionicons name="remove" size={20} color={safeTheme.accentColor} />
                </TouchableOpacity>
                <View style={styles.durationValue}>
                  <Text style={[styles.durationText, { color: safeTheme.textColor }]} testID="work-duration-value">
                    {localWorkDuration}
                  </Text>
                  <Text style={[styles.durationUnit, { color: safeTheme.textColor + '80' }]}>min</Text>
                </View>
                <TouchableOpacity
                  onPress={handleWorkDurationIncrease}
                  style={[styles.controlButton, { borderColor: safeTheme.accentColor }]}
                  testID="work-duration-increase"
                  accessibilityLabel="Increase work duration"
                >
                  <Ionicons name="add" size={20} color={safeTheme.accentColor} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: safeTheme.backgroundColor }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="cafe" size={20} color="#10b981" />
                <Text style={[styles.settingText, { color: safeTheme.textColor }]}>Short Break</Text>
              </View>
              <View style={styles.durationControl}>
                <TouchableOpacity
                  onPress={handleShortBreakDurationDecrease}
                  style={[styles.controlButton, { borderColor: '#10b981' }]}
                  testID="short-break-duration-decrease"
                  accessibilityLabel="Decrease short break duration"
                >
                  <Ionicons name="remove" size={20} color="#10b981" />
                </TouchableOpacity>
                <View style={styles.durationValue}>
                  <Text style={[styles.durationText, { color: safeTheme.textColor }]} testID="short-break-duration-value">
                    {localShortBreakDuration}
                  </Text>
                  <Text style={[styles.durationUnit, { color: safeTheme.textColor + '80' }]}>min</Text>
                </View>
                <TouchableOpacity
                  onPress={handleShortBreakDurationIncrease}
                  style={[styles.controlButton, { borderColor: '#10b981' }]}
                  testID="short-break-duration-increase"
                  accessibilityLabel="Increase short break duration"
                >
                  <Ionicons name="add" size={20} color="#10b981" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: safeTheme.backgroundColor }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="moon" size={20} color={safeTheme.secondaryAccent} />
                <Text style={[styles.settingText, { color: safeTheme.textColor }]}>Long Break</Text>
              </View>
              <View style={styles.durationControl}>
                <TouchableOpacity
                  onPress={handleLongBreakDurationDecrease}
                  style={[styles.controlButton, { borderColor: safeTheme.secondaryAccent }]}
                  testID="long-break-duration-decrease"
                  accessibilityLabel="Decrease long break duration"
                >
                  <Ionicons name="remove" size={20} color={safeTheme.secondaryAccent} />
                </TouchableOpacity>
                <View style={styles.durationValue}>
                  <Text style={[styles.durationText, { color: safeTheme.textColor }]} testID="long-break-duration-value">
                    {localLongBreakDuration}
                  </Text>
                  <Text style={[styles.durationUnit, { color: safeTheme.textColor + '80' }]}>min</Text>
                </View>
                <TouchableOpacity
                  onPress={handleLongBreakDurationIncrease}
                  style={[styles.controlButton, { borderColor: safeTheme.secondaryAccent }]}
                  testID="long-break-duration-increase"
                  accessibilityLabel="Increase long break duration"
                >
                  <Ionicons name="add" size={20} color={safeTheme.secondaryAccent} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="repeat" size={20} color={safeTheme.accentColor} />
            <Text style={[styles.sectionTitle, { color: safeTheme.textColor }]}>Session Intervals</Text>
          </View>

          <View style={[styles.card, { backgroundColor: safeTheme.cardColor }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="layers" size={20} color={safeTheme.accentColor} />
                <View>
                  <Text style={[styles.settingText, { color: safeTheme.textColor }]}>Long Break Interval</Text>
                  <Text style={[styles.settingDescription, { color: safeTheme.textColor + '80' }]}>
                    Work sessions before long break
                  </Text>
                </View>
              </View>
              <View style={styles.durationControl}>
                <TouchableOpacity
                  onPress={handleSessionsUntilLongBreakDecrease}
                  style={[styles.controlButton, { borderColor: safeTheme.accentColor }]}
                  testID="sessions-until-long-break-decrease"
                  accessibilityLabel="Decrease sessions until long break"
                >
                  <Ionicons name="remove" size={20} color={safeTheme.accentColor} />
                </TouchableOpacity>
                <View style={styles.durationValue}>
                  <Text style={[styles.durationText, { color: safeTheme.textColor }]} testID="sessions-until-long-break-value">
                    {localSessionsUntilLongBreak}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleSessionsUntilLongBreakIncrease}
                  style={[styles.controlButton, { borderColor: safeTheme.accentColor }]}
                  testID="sessions-until-long-break-increase"
                  accessibilityLabel="Increase sessions until long break"
                >
                  <Ionicons name="add" size={20} color={safeTheme.accentColor} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="play-skip-forward" size={20} color={safeTheme.accentColor} />
            <Text style={[styles.sectionTitle, { color: safeTheme.textColor }]}>Auto-Start</Text>
          </View>

          <View style={[styles.card, { backgroundColor: safeTheme.cardColor }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="cafe-outline" size={20} color={safeTheme.accentColor} />
                <View>
                  <Text style={[styles.settingText, { color: safeTheme.textColor }]}>Auto-Start Breaks</Text>
                  <Text style={[styles.settingDescription, { color: safeTheme.textColor + '80' }]}>
                    Start breaks automatically after work
                  </Text>
                </View>
              </View>
              <Switch
                value={safeSettings.autoStartBreaks ?? false}
                onValueChange={handleToggleAutoStartBreaks}
                trackColor={{ false: safeTheme.backgroundColor, true: safeTheme.accentColor + '60' }}
                thumbColor={safeSettings.autoStartBreaks ? safeTheme.accentColor : safeTheme.textColor + '40'}
                testID="auto-start-breaks-toggle"
                accessibilityLabel="Toggle auto-start breaks"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: safeTheme.backgroundColor }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="briefcase-outline" size={20} color={safeTheme.accentColor} />
                <View>
                  <Text style={[styles.settingText, { color: safeTheme.textColor }]}>Auto-Start Work</Text>
                  <Text style={[styles.settingDescription, { color: safeTheme.textColor + '80' }]}>
                    Start work sessions after breaks
                  </Text>
                </View>
              </View>
              <Switch
                value={safeSettings.autoStartWork ?? false}
                onValueChange={handleToggleAutoStartWork}
                trackColor={{ false: safeTheme.backgroundColor, true: safeTheme.accentColor + '60' }}
                thumbColor={safeSettings.autoStartWork ? safeTheme.accentColor : safeTheme.textColor + '40'}
                testID="auto-start-work-toggle"
                accessibilityLabel="Toggle auto-start work"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={20} color={safeTheme.accentColor} />
            <Text style={[styles.sectionTitle, { color: safeTheme.textColor }]}>Notifications</Text>
          </View>

          <View style={[styles.card, { backgroundColor: safeTheme.cardColor }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="volume-high" size={20} color={safeTheme.accentColor} />
                <View>
                  <Text style={[styles.settingText, { color: safeTheme.textColor }]}>Sound</Text>
                  <Text style={[styles.settingDescription, { color: safeTheme.textColor + '80' }]}>
                    Play sound on session transitions
                  </Text>
                </View>
              </View>
              <Switch
                value={safeSettings.soundEnabled ?? true}
                onValueChange={handleToggleSound}
                trackColor={{ false: safeTheme.backgroundColor, true: safeTheme.accentColor + '60' }}
                thumbColor={safeSettings.soundEnabled ? safeTheme.accentColor : safeTheme.textColor + '40'}
                testID="sound-enabled-toggle"
                accessibilityLabel="Toggle sound notifications"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: safeTheme.backgroundColor }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="phone-portrait" size={20} color={safeTheme.accentColor} />
                <View>
                  <Text style={[styles.settingText, { color: safeTheme.textColor }]}>Haptic Feedback</Text>
                  <Text style={[styles.settingDescription, { color: safeTheme.textColor + '80' }]}>
                    Vibrate on session transitions
                  </Text>
                </View>
              </View>
              <Switch
                value={safeSettings.hapticsEnabled ?? true}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: safeTheme.backgroundColor, true: safeTheme.accentColor + '60' }}
                thumbColor={safeSettings.hapticsEnabled ? safeTheme.accentColor : safeTheme.textColor + '40'}
                testID="haptics-enabled-toggle"
                accessibilityLabel="Toggle haptic feedback"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={20} color="#ef4444" />
            <Text style={[styles.sectionTitle, { color: safeTheme.textColor }]}>Danger Zone</Text>
          </View>

          <TouchableOpacity
            onPress={handleResetStats}
            style={[styles.resetButton, { borderColor: '#ef4444' }]}
            testID="reset-stats-button"
            accessibilityLabel="Reset all data"
          >
            <LinearGradient
              colors={['#ef444420', '#dc262620']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.resetButtonGradient}
            >
              <Ionicons name="trash" size={20} color="#ef4444" />
              <View style={styles.resetButtonText}>
                <Text style={[styles.resetButtonTitle, { color: '#ef4444' }]}>Reset All Data</Text>
                <Text style={[styles.resetButtonDescription, { color: safeTheme.textColor + '80' }]}>
                  Clear all session history and statistics
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Ionicons name="checkmark-circle" size={16} color={safeTheme.accentColor + '60'} />
          <Text style={[styles.footerText, { color: safeTheme.textColor + '60' }]}>
            Settings are saved automatically
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  durationControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationValue: {
    alignItems: 'center',
    minWidth: 60,
  },
  durationText: {
    fontSize: 20,
    fontWeight: '700',
  },
  durationUnit: {
    fontSize: 12,
    marginTop: 2,
  },
  resetButton: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  resetButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  resetButtonText: {
    flex: 1,
  },
  resetButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  resetButtonDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
  },
});
