import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, G, Text as SvgText, Rect } from 'react-native-svg';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  parseISO,
  isValid,
  startOfDay,
  differenceInDays,
} from 'date-fns';
import { useFocusFlow } from '../context/FocusFlowContext';

const { width } = Dimensions.get('window');

const TIME_PERIODS = [
  { id: 'week', label: 'Week', icon: 'calendar-outline' },
  { id: 'month', label: 'Month', icon: 'calendar' },
  { id: 'all', label: 'All Time', icon: 'infinite' },
];

export default function StatsScreen() {
  const {
    sessions,
    weekStats,
    monthStats,
    currentStreak,
    longestStreak,
    totalFocusTime,
    theme,
  } = useFocusFlow();

  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const safeTheme = theme ?? {
    backgroundColor: '#0f0f1a',
    textColor: '#e0e0e8',
    accentColor: '#6366f1',
    cardColor: '#1a1a2e',
    secondaryAccent: '#8b5cf6',
    borderRadius: 16,
  };

  const safeSessions = useMemo(() => {
    return (sessions || []).filter((s) => s && s.id && s.type && s.completedAt);
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const now = new Date();
    if (selectedPeriod === 'week') {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      return safeSessions.filter((s) => {
        const date = parseISO(s.completedAt);
        return isValid(date) && date >= weekStart;
      });
    } else if (selectedPeriod === 'month') {
      const monthStart = startOfMonth(now);
      return safeSessions.filter((s) => {
        const date = parseISO(s.completedAt);
        return isValid(date) && date >= monthStart;
      });
    }
    return safeSessions;
  }, [safeSessions, selectedPeriod]);

  const totalSessions = filteredSessions.length;

  const completedSessions = useMemo(() => {
    return filteredSessions.filter((s) => !s.interrupted).length;
  }, [filteredSessions]);

  const completionRate = useMemo(() => {
    if (totalSessions === 0) return 0;
    return Math.round((completedSessions / totalSessions) * 100);
  }, [completedSessions, totalSessions]);

  const focusTime = useMemo(() => {
    const total = filteredSessions.reduce((acc, s) => {
      if (s.type === 'work' && !s.interrupted) {
        return acc + (s.duration ?? 0);
      }
      return acc;
    }, 0);
    return total;
  }, [filteredSessions]);

  const formatFocusTime = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const weeklyChartData = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return days.map((day) => {
      const dayStart = startOfDay(day);
      const count = safeSessions.filter((s) => {
        const sessionDate = parseISO(s.completedAt);
        if (!isValid(sessionDate)) return false;
        const sessionDayStart = startOfDay(sessionDate);
        return sessionDayStart.getTime() === dayStart.getTime();
      }).length;

      return {
        day: format(day, 'EEE'),
        count,
      };
    });
  }, [safeSessions]);

  const sessionBreakdown = useMemo(() => {
    const workCount = filteredSessions.filter((s) => s.type === 'work').length;
    const breakCount = filteredSessions.filter(
      (s) => s.type === 'shortBreak' || s.type === 'longBreak'
    ).length;

    const total = workCount + breakCount;
    if (total === 0) {
      return { work: 0, break: 0, workPercent: 0, breakPercent: 0 };
    }

    return {
      work: workCount,
      break: breakCount,
      workPercent: Math.round((workCount / total) * 100),
      breakPercent: Math.round((breakCount / total) * 100),
    };
  }, [filteredSessions]);

  const handlePeriodPress = (periodId) => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedPeriod(periodId);
  };

  const maxWeeklyCount = Math.max(...weeklyChartData.map((d) => d.count), 1);

  return (
    <View
      style={[styles.container, { backgroundColor: safeTheme.backgroundColor }]}
      testID="stats-screen"
      accessibilityLabel="Statistics screen"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[styles.title, { color: safeTheme.textColor }]}
          testID="stats-title"
        >
          Statistics
        </Text>

        <View style={styles.periodSelector} testID="time-period-selector">
          {TIME_PERIODS.map((period) => (
            <TouchableOpacity
              key={period.id}
              style={[
                styles.periodButton,
                {
                  backgroundColor:
                    selectedPeriod === period.id
                      ? safeTheme.accentColor
                      : safeTheme.cardColor,
                },
              ]}
              onPress={() => handlePeriodPress(period.id)}
              testID={`period-button-${period.id}`}
              accessibilityLabel={`Select ${period.label} period`}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedPeriod === period.id }}
            >
              <Ionicons
                name={period.icon}
                size={18}
                color={
                  selectedPeriod === period.id
                    ? '#ffffff'
                    : safeTheme.textColor + '80'
                }
              />
              <Text
                style={[
                  styles.periodButtonText,
                  {
                    color:
                      selectedPeriod === period.id
                        ? '#ffffff'
                        : safeTheme.textColor + '80',
                  },
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.summaryCards} testID="summary-cards">
          <LinearGradient
            colors={[safeTheme.accentColor, safeTheme.secondaryAccent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.summaryCard, { borderRadius: safeTheme.borderRadius }]}
          >
            <View style={styles.summaryCardContent}>
              <Ionicons name="checkmark-circle" size={32} color="#ffffff" />
              <Text style={styles.summaryCardValue} testID="total-sessions-value">
                {totalSessions}
              </Text>
              <Text style={styles.summaryCardLabel} testID="total-sessions-label">
                Total Sessions
              </Text>
            </View>
          </LinearGradient>

          <LinearGradient
            colors={['#10b981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.summaryCard, { borderRadius: safeTheme.borderRadius }]}
          >
            <View style={styles.summaryCardContent}>
              <Ionicons name="time" size={32} color="#ffffff" />
              <Text style={styles.summaryCardValue} testID="focus-time-value">
                {formatFocusTime(focusTime)}
              </Text>
              <Text style={styles.summaryCardLabel} testID="focus-time-label">
                Focus Time
              </Text>
            </View>
          </LinearGradient>

          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.summaryCard, { borderRadius: safeTheme.borderRadius }]}
          >
            <View style={styles.summaryCardContent}>
              <Ionicons name="trophy" size={32} color="#ffffff" />
              <Text style={styles.summaryCardValue} testID="completion-rate-value">
                {completionRate}%
              </Text>
              <Text style={styles.summaryCardLabel} testID="completion-rate-label">
                Completion Rate
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: safeTheme.cardColor,
              borderRadius: safeTheme.borderRadius,
            },
          ]}
          testID="weekly-chart"
        >
          <View style={styles.chartHeader}>
            <Ionicons
              name="bar-chart"
              size={24}
              color={safeTheme.accentColor}
            />
            <Text
              style={[styles.chartTitle, { color: safeTheme.textColor }]}
              testID="weekly-chart-title"
            >
              Weekly Activity
            </Text>
          </View>

          {weeklyChartData.length > 0 ? (
            <Svg width={width - 64} height={200} testID="weekly-chart-svg">
              <G>
                {weeklyChartData.map((item, index) => {
                  const barWidth = (width - 64 - 60) / 7;
                  const barHeight = (item.count / maxWeeklyCount) * 140;
                  const x = index * barWidth + 10;
                  const y = 160 - barHeight;

                  return (
                    <G key={index}>
                      <Rect
                        x={x}
                        y={y}
                        width={barWidth - 10}
                        height={barHeight}
                        fill={safeTheme.accentColor}
                        rx={4}
                        testID={`bar-${index}`}
                      />
                      <SvgText
                        x={x + (barWidth - 10) / 2}
                        y={180}
                        fontSize={12}
                        fill={safeTheme.textColor + '80'}
                        textAnchor="middle"
                      >
                        {item.day}
                      </SvgText>
                      {item.count > 0 && (
                        <SvgText
                          x={x + (barWidth - 10) / 2}
                          y={y - 5}
                          fontSize={12}
                          fill={safeTheme.textColor}
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {item.count}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
              </G>
            </Svg>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="bar-chart-outline"
                size={48}
                color={safeTheme.textColor + '40'}
              />
              <Text
                style={[
                  styles.emptyStateText,
                  { color: safeTheme.textColor + '80' },
                ]}
              >
                No sessions this week
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: safeTheme.cardColor,
              borderRadius: safeTheme.borderRadius,
            },
          ]}
          testID="session-breakdown"
        >
          <View style={styles.chartHeader}>
            <Ionicons
              name="pie-chart"
              size={24}
              color={safeTheme.accentColor}
            />
            <Text
              style={[styles.chartTitle, { color: safeTheme.textColor }]}
              testID="breakdown-title"
            >
              Session Breakdown
            </Text>
          </View>

          {sessionBreakdown.work + sessionBreakdown.break > 0 ? (
            <View style={styles.pieChartContainer}>
              <Svg width={160} height={160} testID="pie-chart-svg">
                <G rotation="-90" origin="80, 80">
                  <Circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke={safeTheme.accentColor}
                    strokeWidth="30"
                    strokeDasharray={`${
                      (sessionBreakdown.workPercent / 100) * 2 * Math.PI * 70
                    } ${2 * Math.PI * 70}`}
                    testID="pie-work-segment"
                  />
                  <Circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="30"
                    strokeDasharray={`${
                      (sessionBreakdown.breakPercent / 100) * 2 * Math.PI * 70
                    } ${2 * Math.PI * 70}`}
                    strokeDashoffset={`-${
                      (sessionBreakdown.workPercent / 100) * 2 * Math.PI * 70
                    }`}
                    testID="pie-break-segment"
                  />
                </G>
              </Svg>

              <View style={styles.pieChartLegend}>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: safeTheme.accentColor },
                    ]}
                  />
                  <Text
                    style={[
                      styles.legendText,
                      { color: safeTheme.textColor },
                    ]}
                    testID="work-sessions-count"
                  >
                    Work: {sessionBreakdown.work} ({sessionBreakdown.workPercent}
                    %)
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: '#10b981' }]}
                  />
                  <Text
                    style={[
                      styles.legendText,
                      { color: safeTheme.textColor },
                    ]}
                    testID="break-sessions-count"
                  >
                    Breaks: {sessionBreakdown.break} (
                    {sessionBreakdown.breakPercent}%)
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="pie-chart-outline"
                size={48}
                color={safeTheme.textColor + '40'}
              />
              <Text
                style={[
                  styles.emptyStateText,
                  { color: safeTheme.textColor + '80' },
                ]}
              >
                No sessions to display
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: safeTheme.cardColor,
              borderRadius: safeTheme.borderRadius,
            },
          ]}
          testID="streak-tracker"
        >
          <View style={styles.chartHeader}>
            <Ionicons name="flame" size={24} color="#f59e0b" />
            <Text
              style={[styles.chartTitle, { color: safeTheme.textColor }]}
              testID="streak-title"
            >
              Streak Tracker
            </Text>
          </View>

          <View style={styles.streakContainer}>
            <View style={styles.streakItem}>
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.streakBadge}
              >
                <Ionicons name="flame" size={32} color="#ffffff" />
              </LinearGradient>
              <Text
                style={[styles.streakValue, { color: safeTheme.textColor }]}
                testID="current-streak-value"
              >
                {currentStreak ?? 0} days
              </Text>
              <Text
                style={[
                  styles.streakLabel,
                  { color: safeTheme.textColor + '80' },
                ]}
                testID="current-streak-label"
              >
                Current Streak
              </Text>
            </View>

            <View style={styles.streakDivider} />

            <View style={styles.streakItem}>
              <LinearGradient
                colors={[safeTheme.accentColor, safeTheme.secondaryAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.streakBadge}
              >
                <Ionicons name="trophy" size={32} color="#ffffff" />
              </LinearGradient>
              <Text
                style={[styles.streakValue, { color: safeTheme.textColor }]}
                testID="longest-streak-value"
              >
                {longestStreak ?? 0} days
              </Text>
              <Text
                style={[
                  styles.streakLabel,
                  { color: safeTheme.textColor + '80' },
                ]}
                testID="longest-streak-label"
              >
                Longest Streak
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
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
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 20,
    marginTop: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
  },
  summaryCardContent: {
    alignItems: 'center',
    gap: 8,
  },
  summaryCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  summaryCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
  },
  chartCard: {
    padding: 20,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pieChartContainer: {
    alignItems: 'center',
    gap: 20,
  },
  pieChartLegend: {
    gap: 12,
    alignSelf: 'stretch',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  streakBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  streakDivider: {
    width: 1,
    height: 80,
    backgroundColor: '#ffffff20',
  },
  bottomSpacer: {
    height: 40,
  },
});
