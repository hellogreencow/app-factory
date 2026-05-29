
import React, { useContext, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTracker } from '../context/TrackerContext';

const moodColors = {
  great: 'green',
  good: 'blue',
  okay: 'orange',
  meh: 'gray',
};

const StatsScreen = () => {
  const { entries, streak, longestStreak, totalEntries, moodCounts, weekEntries } = useTracker();
  const entryCount = Object.keys(entries || {}).length;

  const totalDays = useMemo(() => Object.keys(entries).length, [entries]);

  // Trend Calculation
  const trendData = useMemo(() => {
    if (totalEntries < 7) return null;

    const now = new Date();
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 6);
    const twoWeeksAgoStart = new Date(now);
    twoWeeksAgoStart.setDate(now.getDate() - 13);

    let thisWeekMoods = { great: 0, good: 0, okay: 0, meh: 0 };
    let lastWeekMoods = { great: 0, good: 0, okay: 0, meh: 0 };

    Object.entries(entries).forEach(([date, entry]) => {
      const entryDate = new Date(date);
      if (entryDate >= lastWeekStart && entryDate <= now) {
        thisWeekMoods[entry.mood]++;
      } else if (entryDate >= twoWeeksAgoStart && entryDate < lastWeekStart) {
        lastWeekMoods[entry.mood]++;
      }
    });

    const thisWeekScore = thisWeekMoods.great * 4 + thisWeekMoods.good * 3 + thisWeekMoods.okay * 2 + thisWeekMoods.meh * 1;
    const lastWeekScore = lastWeekMoods.great * 4 + lastWeekMoods.good * 3 + lastWeekMoods.okay * 2 + lastWeekMoods.meh * 1;

    const diff = thisWeekScore - lastWeekScore;

    let trendText = 'Holding steady';
    let trendArrow = '↔️';

    if (diff > 1) {
      trendText = 'Better week than last';
      trendArrow = '⬆️';
    } else if (diff < -1) {
      trendText = 'Slightly worse than last week';
      trendArrow = '⬇️';
    }

    return { trendText, trendArrow };
  }, [entries, totalEntries]);

  if (entryCount < 3) {
    return (
      <View style={styles.emptyContainer} testID="empty-stats">
        <Text style={styles.emptyEmoji}>✨</Text>
        <Text style={styles.emptyTitle}>Let the ink dry</Text>
        <Text style={styles.emptySubtitle}>
          Unlock insights as you continue to build your collection.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="stats-screen">
      <View style={styles.header}>
        <Text style={styles.title}>A Gallery of Evenings</Text>
      </View>

      {/* Trend Section */}
      <View style={styles.section} testID="stat-trend">
        <Text style={styles.sectionTitle}>Trend</Text>
        {trendData ? (
          <Text style={styles.sectionText}>
            {trendData.trendArrow} {trendData.trendText}
          </Text>
        ) : (
          <Text style={styles.sectionText}>Keep logging to see trends</Text>
        )}
      </View>

      {/* Streaks Section */}
      <View style={styles.section} testID="stat-longest">
        <Text style={styles.sectionTitle}>Streaks</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{longestStreak}</Text>
            <Text style={styles.statLabel}>Longest Streak</Text>
          </View>
        </View>
      </View>

      {/* Weekly Pattern Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Pattern</Text>
        <View style={styles.weeklyPattern}>
          {weekEntries.map(({ day, entry }) => (
            <View key={day} style={styles.dayContainer}>
              <Text style={styles.dayAbbreviation}>{day}</Text>
              <View
                style={[
                  styles.moodCircle,
                  entry ? { backgroundColor: moodColors[entry.mood] } : styles.emptyCircle,
                ]}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Total Days Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Total Days</Text>
        <Text style={styles.sectionText}>You've logged {totalDays} days since your first entry.</Text>
      </View>

      {/* Mood Breakdown Section (Existing) */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{entryCount}</Text>
          <Text style={styles.statLabel}>Total Days</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{entryCount * 3}</Text>
          <Text style={styles.statLabel}>Golden hours kept</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Consistency</Text>
        <Text style={styles.sectionText}>You're building a beautiful habit. Keep going!</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0d1117',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#8b949e',
    marginBottom: 8,
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: '#161b22',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d97706',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#161b22',
    margin: 8,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8b949e',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#58a6ff',
  },
  statLabel: {
    fontSize: 14,
    color: '#8b949e',
    marginTop: 4,
  },
  section: {
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: '#8b949e',
    lineHeight: 24,
  },
  weeklyPattern: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  dayContainer: {
    alignItems: 'center',
  },
  dayAbbreviation: {
    fontSize: 12,
    color: '#8b949e',
    marginBottom: 4,
  },
  moodCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  emptyCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#161b22', // Same as statCard background
  },
});

export default StatsScreen;
