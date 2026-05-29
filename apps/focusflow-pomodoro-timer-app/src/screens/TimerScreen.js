import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useFocusFlow } from '../context/FocusFlowContext';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = width * 0.7;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function TimerScreen() {
  const { settings, addSession, completeSession, theme } = useFocusFlow();
  
  const [sessionType, setSessionType] = useState('work');
  const [timeRemaining, setTimeRemaining] = useState((settings?.workDuration ?? 25) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedWorkSessions, setCompletedWorkSessions] = useState(0);
  
  const intervalRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const totalDuration = React.useMemo(() => {
    if (sessionType === 'work') return (settings?.workDuration ?? 25) * 60;
    if (sessionType === 'shortBreak') return (settings?.shortBreakDuration ?? 5) * 60;
    if (sessionType === 'longBreak') return (settings?.longBreakDuration ?? 15) * 60;
    return 25 * 60;
  }, [sessionType, settings]);

  useEffect(() => {
    const progress = 1 - (timeRemaining / totalDuration);
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [timeRemaining, totalDuration]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSessionComplete();
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
  }, [isRunning]);

  const handleSessionComplete = () => {
    setIsRunning(false);
    
    if (settings?.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const session = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      type: sessionType,
      duration: sessionType === 'work' ? (settings?.workDuration ?? 25) : sessionType === 'shortBreak' ? (settings?.shortBreakDuration ?? 5) : (settings?.longBreakDuration ?? 15),
      completedAt: new Date().toISOString(),
      interrupted: false,
    };

    if (typeof completeSession === 'function') {
      completeSession(session);
    } else if (typeof addSession === 'function') {
      addSession(session);
    }

    if (sessionType === 'work') {
      const newCount = completedWorkSessions + 1;
      setCompletedWorkSessions(newCount);
      
      const sessionsUntilLong = settings?.sessionsUntilLongBreak ?? 4;
      const nextType = newCount % sessionsUntilLong === 0 ? 'longBreak' : 'shortBreak';
      
      if (settings?.autoStartBreaks) {
        setSessionType(nextType);
        setTimeRemaining(nextType === 'longBreak' ? (settings?.longBreakDuration ?? 15) * 60 : (settings?.shortBreakDuration ?? 5) * 60);
        setTimeout(() => setIsRunning(true), 1000);
      } else {
        setSessionType(nextType);
        setTimeRemaining(nextType === 'longBreak' ? (settings?.longBreakDuration ?? 15) * 60 : (settings?.shortBreakDuration ?? 5) * 60);
      }
    } else {
      if (settings?.autoStartWork) {
        setSessionType('work');
        setTimeRemaining((settings?.workDuration ?? 25) * 60);
        setTimeout(() => setIsRunning(true), 1000);
      } else {
        setSessionType('work');
        setTimeRemaining((settings?.workDuration ?? 25) * 60);
      }
    }
  };

  const handleStartPause = () => {
    if (settings?.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    if (settings?.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setIsRunning(false);
    setTimeRemaining(totalDuration);
  };

  const handleSkip = () => {
    if (settings?.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsRunning(false);
    
    if (sessionType === 'work') {
      const newCount = completedWorkSessions + 1;
      setCompletedWorkSessions(newCount);
      const sessionsUntilLong = settings?.sessionsUntilLongBreak ?? 4;
      const nextType = newCount % sessionsUntilLong === 0 ? 'longBreak' : 'shortBreak';
      setSessionType(nextType);
      setTimeRemaining(nextType === 'longBreak' ? (settings?.longBreakDuration ?? 15) * 60 : (settings?.shortBreakDuration ?? 5) * 60);
    } else {
      setSessionType('work');
      setTimeRemaining((settings?.workDuration ?? 25) * 60);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getGradientColors = () => {
    if (sessionType === 'work') {
      return ['#6366f1', '#8b5cf6'];
    } else if (sessionType === 'shortBreak') {
      return ['#10b981', '#06b6d4'];
    } else {
      return ['#f59e0b', '#ef4444'];
    }
  };

  const getBackgroundGradient = () => {
    if (sessionType === 'work') {
      return ['#0f0f1a', '#1a1a2e', '#2a2a4e'];
    } else if (sessionType === 'shortBreak') {
      return ['#0f1a14', '#1a2e26', '#2a4e3e'];
    } else {
      return ['#1a0f0f', '#2e1a1a', '#4e2a2a'];
    }
  };

  const getSessionIcon = () => {
    if (sessionType === 'work') return 'briefcase';
    if (sessionType === 'shortBreak') return 'cafe';
    return 'bed';
  };

  const getSessionLabel = () => {
    if (sessionType === 'work') return 'Focus Time';
    if (sessionType === 'shortBreak') return 'Short Break';
    return 'Long Break';
  };

  const sessionsUntilLong = settings?.sessionsUntilLongBreak ?? 4;
  const sessionsToLongBreak = sessionsUntilLong - (completedWorkSessions % sessionsUntilLong);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const gradientColors = getGradientColors();
  const backgroundGradient = getBackgroundGradient();

  return (
    <LinearGradient
      colors={backgroundGradient}
      style={styles.container}
      testID="timer-screen-background-gradient"
    >
      <View style={styles.header}>
        <View style={styles.sessionBadge} testID="session-indicator">
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badgeGradient}
          >
            <Ionicons name={getSessionIcon()} size={20} color="#fff" />
            <Text style={styles.sessionLabel} accessibilityLabel={`Current session: ${getSessionLabel()}`}>
              {getSessionLabel()}
            </Text>
          </LinearGradient>
        </View>

        {sessionType === 'work' && (
          <View style={styles.progressIndicator} testID="long-break-progress">
            <Ionicons name="trophy-outline" size={16} color={theme?.textColor ?? '#e0e0e8'} />
            <Text style={styles.progressText} accessibilityLabel={`${sessionsToLongBreak} sessions until long break`}>
              {sessionsToLongBreak} to long break
            </Text>
          </View>
        )}
      </View>

      <View style={styles.timerContainer}>
        <Animated.View style={[styles.circleWrapper, { transform: [{ scale: scaleAnim }] }]}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} testID="circular-timer">
            <Defs>
              <SvgLinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity="1" />
                <Stop offset="100%" stopColor={gradientColors[1]} stopOpacity="1" />
              </SvgLinearGradient>
            </Defs>
            
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={theme?.cardColor ?? '#1a1a2e'}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            
            <AnimatedCircle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke="url(#gradient)"
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
            />
          </Svg>

          <View style={styles.timeDisplay}>
            <Text style={styles.timeText} testID="time-display" accessibilityLabel={`Time remaining: ${formatTime(timeRemaining)}`}>
              {formatTime(timeRemaining)}
            </Text>
            <Text style={styles.timeSubtext}>
              {isRunning ? 'In Progress' : 'Paused'}
            </Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.controls} testID="timer-controls">
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleReset}
          testID="reset-button"
          accessibilityLabel="Reset timer"
          accessibilityRole="button"
        >
          <View style={[styles.iconButton, styles.secondaryButton]}>
            <Ionicons name="refresh" size={24} color={theme?.textColor ?? '#e0e0e8'} />
          </View>
          <Text style={styles.controlLabel}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleStartPause}
          testID="start-pause-button"
          accessibilityLabel={isRunning ? 'Pause timer' : 'Start timer'}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButton}
          >
            <Ionicons name={isRunning ? 'pause' : 'play'} size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.controlLabel}>{isRunning ? 'Pause' : 'Start'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleSkip}
          testID="skip-button"
          accessibilityLabel="Skip to next session"
          accessibilityRole="button"
        >
          <View style={[styles.iconButton, styles.secondaryButton]}>
            <Ionicons name="play-skip-forward" size={24} color={theme?.textColor ?? '#e0e0e8'} />
          </View>
          <Text style={styles.controlLabel}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sessionInfo}>
        <View style={styles.infoCard}>
          <Ionicons name="checkmark-circle" size={20} color={gradientColors[0]} />
          <Text style={styles.infoText} accessibilityLabel={`Completed work sessions: ${completedWorkSessions}`}>
            {completedWorkSessions} sessions today
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  sessionBadge: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  sessionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  progressText: {
    color: '#e0e0e8',
    fontSize: 13,
    fontWeight: '600',
  },
  timerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeDisplay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 56,
    fontWeight: '700',
    color: '#e0e0e8',
    letterSpacing: 2,
  },
  timeSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e0e8',
    opacity: 0.6,
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginBottom: 40,
  },
  controlButton: {
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  secondaryButton: {
    backgroundColor: '#1a1a2e',
  },
  controlLabel: {
    color: '#e0e0e8',
    fontSize: 12,
    fontWeight: '600',
  },
  sessionInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  infoText: {
    color: '#e0e0e8',
    fontSize: 14,
    fontWeight: '600',
  },
});
