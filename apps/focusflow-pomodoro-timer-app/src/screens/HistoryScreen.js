import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { format, formatDistanceToNow, startOfDay, isValid, parseISO } from 'date-fns';
import { useFocusFlow } from '../context/FocusFlowContext';

const { width } = Dimensions.get('window');

const SESSION_TYPE_CONFIG = {
  work: {
    label: 'Work',
    icon: 'briefcase',
    gradient: ['#6366f1', '#8b5cf6'],
    color: '#6366f1',
  },
  shortBreak: {
    label: 'Short Break',
    icon: 'cafe',
    gradient: ['#10b981', '#059669'],
    color: '#10b981',
  },
  longBreak: {
    label: 'Long Break',
    icon: 'moon',
    gradient: ['#8b5cf6', '#a855f7'],
    color: '#8b5cf6',
  },
};

const FILTER_OPTIONS = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'work', label: 'Work', icon: 'briefcase' },
  { id: 'shortBreak', label: 'Short Break', icon: 'cafe' },
  { id: 'longBreak', label: 'Long Break', icon: 'moon' },
];

export default function HistoryScreen() {
  const { sessions, deleteSession, theme } = useFocusFlow();
  const [selectedFilter, setSelectedFilter] = useState('all');

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
    if (selectedFilter === 'all') {
      return safeSessions;
    }
    return safeSessions.filter((s) => s.type === selectedFilter);
  }, [safeSessions, selectedFilter]);

  const groupedSessions = useMemo(() => {
    const groups = {};

    (filteredSessions || []).forEach((session) => {
      const dateStr = session?.completedAt;
      if (!dateStr) return;

      const parsed = parseISO(dateStr);
      const date = isValid(parsed) ? parsed : new Date();
      const dayKey = format(startOfDay(date), 'yyyy-MM-dd');

      if (!groups[dayKey]) {
        groups[dayKey] = {
          date: date,
          sessions: [],
        };
      }
      groups[dayKey].sessions.push(session);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const dateA = groups[a].date;
      const dateB = groups[b].date;
      return dateB - dateA;
    });

    return sortedKeys.map((key) => groups[key]);
  }, [filteredSessions]);

  const handleFilterPress = (filterId) => {
    if (typeof Haptics?.impactAsync === 'function') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedFilter(filterId);
  };

  const handleDeleteSession = (sessionId) => {
    if (typeof Haptics?.notificationAsync === 'function') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Alert.alert(
      'Delete Session',
      'Remove this memory from your flow?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (typeof deleteSession === 'function') {
              deleteSession(sessionId);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderRightActions = (sessionId) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDeleteSession(sessionId)}
        testID={`delete-session-${sessionId}`}
        accessibilityLabel="Delete session"
      >
        <Ionicons name="trash" size={24} color="#fff" />
      </TouchableOpacity>
    );
  };

  const renderSessionCard = (session) => {
    const config = SESSION_TYPE_CONFIG[session?.type] ?? SESSION_TYPE_CONFIG.work;
    const dateStr = session?.completedAt;
    const parsed = dateStr ? parseISO(dateStr) : null;
    const date = parsed && isValid(parsed) ? parsed : new Date();
    const timeStr = format(date, 'h:mm a');
    const relativeTime = formatDistanceToNow(date, { addSuffix: true });
    const duration = session?.duration ?? 0;
    const interrupted = session?.interrupted ?? false;

    return (
      <Swipeable
        key={session?.id ?? Math.random().toString()}
        renderRightActions={() => renderRightActions(session?.id)}
        overshootRight={false}
        testID={`swipeable-session-${session?.id}`}
      >
        <View style={styles.sessionCardWrapper}>
          <LinearGradient
            colors={config.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sessionCardGradient}
          >
            <View
              style={[styles.sessionCard, { backgroundColor: safeTheme.cardColor }]}
              testID={`session-card-${session?.id}`}
              accessibilityLabel={`${config.label} session, ${duration} minutes, completed ${relativeTime}`}
            >
              <View style={styles.sessionCardLeft}>
                <View
                  style={[
                    styles.sessionIconContainer,
                    { backgroundColor: config.color + '20' },
                  ]}
                >
                  <Ionicons name={config.icon} size={24} color={config.color} />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionType, { color: safeTheme.textColor }]}>
                    {config.label}
                  </Text>
                  <Text style={[styles.sessionTime, { color: safeTheme.textColor + 'aa' }]}>
                    {timeStr}
                  </Text>
                </View>
              </View>

              <View style={styles.sessionCardRight}>
                <Text style={[styles.sessionDuration, { color: safeTheme.textColor }]}>
                  {duration} min
                </Text>
                {interrupted && (
                  <View style={styles.interruptedBadge}>
                    <Ionicons name="alert-circle" size={14} color="#f59e0b" />
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      </Swipeable>
    );
  };

  const renderDateGroup = (group) => {
    const dateStr = format(group?.date ?? new Date(), 'EEEE, MMMM d, yyyy');
    const relativeDate = formatDistanceToNow(group?.date ?? new Date(), { addSuffix: true });

    return (
      <View
        key={format(group?.date ?? new Date(), 'yyyy-MM-dd')}
        style={styles.dateGroup}
        testID={`date-group-${format(group?.date ?? new Date(), 'yyyy-MM-dd')}`}
      >
        <View style={styles.dateHeader}>
          <Text style={[styles.dateLabel, { color: safeTheme.textColor }]}>{dateStr}</Text>
          <Text style={[styles.dateRelative, { color: safeTheme.textColor + '99' }]}>
            {relativeDate}
          </Text>
        </View>
        <View style={styles.sessionsList}>
          {(group?.sessions || []).map((session) => renderSessionCard(session))}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyState} testID="empty-state">
        <Ionicons name="time-outline" size={80} color={safeTheme.textColor + '40'} />
        <Text style={[styles.emptyTitle, { color: safeTheme.textColor }]}>
          No sessions yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: safeTheme.textColor + '99' }]}>
          {selectedFilter === 'all'
            ? "Your future focus will echo here. Start a timer to begin."
            : `No ${FILTER_OPTIONS.find((f) => f.id === selectedFilter)?.label ?? 'sessions'} sessions found`}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: safeTheme.backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: safeTheme.textColor }]} testID="history-title">
          History
        </Text>
        <Text style={[styles.subtitle, { color: safeTheme.textColor + 'aa' }]}>
          {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
        testID="filter-scroll"
      >
        {FILTER_OPTIONS.map((filter) => {
          const isSelected = selectedFilter === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected
                    ? safeTheme.accentColor
                    : safeTheme.cardColor,
                },
              ]}
              onPress={() => handleFilterPress(filter.id)}
              testID={`filter-${filter.id}`}
              accessibilityLabel={`Filter by ${filter.label}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Ionicons
                name={filter.icon}
                size={18}
                color={isSelected ? '#fff' : safeTheme.textColor}
              />
              <Text
                style={[
                  styles.filterLabel,
                  {
                    color: isSelected ? '#fff' : safeTheme.textColor,
                  },
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="sessions-scroll"
      >
        {groupedSessions.length === 0 ? (
          renderEmptyState()
        ) : (
          (groupedSessions || []).map((group) => renderDateGroup(group))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  filterContainer: {
    maxHeight: 60,
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateRelative: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionsList: {
    gap: 12,
  },
  sessionCardWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  sessionCardGradient: {
    padding: 2,
    borderRadius: 16,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
  },
  sessionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sessionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionType: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  sessionTime: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDuration: {
    fontSize: 16,
    fontWeight: '700',
  },
  interruptedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
});
