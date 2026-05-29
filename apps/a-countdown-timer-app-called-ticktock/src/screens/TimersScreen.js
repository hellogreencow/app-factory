
import React, { useContext } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, format } from 'date-fns';
import { useTimerContext } from '../context/AppContext';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const TimersScreen = () => {
  const { activeTimers, deleteTimer, theme } = useContext(useTimerContext);

  const renderItem = ({ item }) => {
    const now = new Date();
    const endDateSafe = new Date(item?.endDate);
    const timeRemainingMs = endDateSafe.getTime() - now.getTime();
    const nearingDeadline = timeRemainingMs < 24 * 60 * 60 * 1000; // Less than 24 hours

    const timeLeftString = formatDistanceToNow(endDateSafe, { addSuffix: true });
    const formattedEndDate = format(endDateSafe, 'MMM dd, yyyy hh:mm a');

    const renderRightActions = (progress, dragX) => {
      const trans = dragX.interpolate({
        inputRange: [-100, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });
      return (
        <TouchableOpacity
          testID={`delete-timer-${item?.id}`}
          accessibilityLabel={`delete-timer-${item?.id}`}
          style={[styles.deleteButton, { backgroundColor: theme.accentColor }]}
          onPress={() => {
            deleteTimer(item?.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        >
          <Animated.View style={{ transform: [{ translateX: trans }] }}>
            <Ionicons name="trash-outline" size={24} color={theme.textColor} />
          </Animated.View>
        </TouchableOpacity>
      );
    };

    return (
      <Swipeable renderRightActions={renderRightActions}>
        <View style={[styles.card, { backgroundColor: theme.cardColor }]}>
          <LinearGradient
            colors={[theme.cardColor, nearingDeadline ? theme.accentColor : theme.secondaryAccent]}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={styles.cardContent}>
            <Text
              testID={`timer-name-${item?.id}`}
              accessibilityLabel={`timer-name-${item?.id}`}
              style={[styles.timerName, { color: theme.textColor }]}
            >
              {item?.name ?? 'The Unspoken'}
            </Text>
            <Text
              testID={`timer-description-${item?.id}`}
              accessibilityLabel={`timer-description-${item?.id}`}
              style={[styles.timerDescription, { color: theme.textColor }]}
            >
              {item?.description ?? 'A quiet pursuit.'}
            </Text>
            <View style={styles.timerInfo}>
              <Ionicons name="time-outline" size={16} color={theme.textColor} style={styles.icon} />
              <Text
                testID={`timer-time-left-${item?.id}`}
                accessibilityLabel={`timer-time-left-${item?.id}`}
                style={[styles.timerText, { color: theme.textColor, fontSize: 72 }]}
              >
                {timeLeftString}
              </Text>
            </View>
            <View style={styles.timerInfo}>
              <Ionicons name="calendar-outline" size={16} color={theme.textColor} style={styles.icon} />
              <Text
                testID={`timer-end-date-${item?.id}`}
                accessibilityLabel={`timer-end-date-${item?.id}`}
                style={[styles.timerText, { color: theme.textColor }]}
              >
                {formattedEndDate}
              </Text>
            </View>
          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {activeTimers && activeTimers.length > 0 ? (
        <FlatList
          data={activeTimers}
          renderItem={renderItem}
          keyExtractor={(item) => item?.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="hourglass-outline" size={64} color="gray" />
          <Text style={[styles.emptyText, { color: 'gray' }]}>No timers yet. Create one!</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
    opacity: 0.15,
  },
  cardContent: {
    padding: 16,
  },
  timerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  timerDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  timerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    marginRight: 8,
  },
  timerText: {
    fontSize: 14,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginVertical: 10,
    marginRight: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
});

export default TimersScreen;
