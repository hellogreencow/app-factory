import React, { useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-svg';
import { usePoopData } from '../context/AppContext';

const { width } = Dimensions.get('window');

const generateTestID = (base) => `stats-screen-${base}`;

const StatsScreen = () => {
  const { theme, poopStats } = usePoopData();

  const renderConsistencyChart = () => {
    const consistencyData = poopStats?.consistency;

    if (!consistencyData || Object.keys(consistencyData).length === 0) {
      return (
        <View style={styles.emptyChartContainer} testID={generateTestID('empty-consistency-chart')}>
          <Ionicons name="sad-outline" size={48} color={theme?.textColor} />
          <Text style={[styles.emptyChartText, { color: theme?.textColor }]}>No consistency data available.</Text>
        </View>
      );
    }

    const data = Object.entries(consistencyData).map(([key, value]) => ({
      key,
      value,
      svg: { fill: getRandomColor() },
      arc: { cornerRadius: 5 },
    }));

    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
      <View style={styles.chartContainer} testID={generateTestID('consistency-chart')}>
        <Text style={[styles.chartTitle, { color: theme?.textColor }]}>Consistency Distribution</Text>
        <PieChart
          style={{ height: 200, width: 200 }}
          data={data}
          accessibilityLabel="Pie chart of poop consistency distribution"
        />
        <View style={styles.legendContainer}>
          {(data || []).map((item, index) => (
            <View key={index} style={styles.legendItem} testID={generateTestID(`consistency-legend-${item.key}`)}>
              <View style={[styles.legendColor, { backgroundColor: item.svg.fill }]} />
              <Text style={[styles.legendText, { color: theme?.textColor }]}>
                {item.key} ({((item.value / total) * 100).toFixed(1)}%)
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderColorChart = () => {
    const colorData = poopStats?.color;

    if (!colorData || Object.keys(colorData).length === 0) {
      return (
        <View style={styles.emptyChartContainer} testID={generateTestID('empty-color-chart')}>
          <Ionicons name="sad-outline" size={48} color={theme?.textColor} />
          <Text style={[styles.emptyChartText, { color: theme?.textColor }]}>No color data available.</Text>
        </View>
      );
    }

    const data = Object.entries(colorData).map(([key, value]) => ({
      key,
      value,
      svg: { fill: getRandomColor() },
      arc: { cornerRadius: 5 },
    }));

    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
      <View style={styles.chartContainer} testID={generateTestID('color-chart')}>
        <Text style={[styles.chartTitle, { color: theme?.textColor }]}>Color Distribution</Text>
        <PieChart
          style={{ height: 200, width: 200 }}
          data={data}
          accessibilityLabel="Pie chart of poop color distribution"
        />
        <View style={styles.legendContainer}>
          {(data || []).map((item, index) => (
            <View key={index} style={styles.legendItem} testID={generateTestID(`color-legend-${item.key}`)}>
              <View style={[styles.legendColor, { backgroundColor: item.svg.fill }]} />
              <Text style={[styles.legendText, { color: theme?.textColor }]}>
                {item.key} ({((item.value / total) * 100).toFixed(1)}%)
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderFrequencyStat = () => {
    const averageFrequency = poopStats?.averageFrequency;

    return (
      <View style={[styles.statCard, { backgroundColor: theme?.cardColor }]} testID={generateTestID('frequency-stat')}>
        <LinearGradient
          colors={[theme?.accentColor, theme?.secondaryAccent]}
          style={styles.gradientHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.statTitle}>Average Daily Frequency</Text>
          <Ionicons name="calendar" size={24} color={theme?.textColor} />
        </LinearGradient>
        <Text style={[styles.statValue, { color: theme?.textColor }]}>
          {averageFrequency !== null ? averageFrequency.toFixed(2) : 'N/A'}
        </Text>
        <Text style={[styles.statUnit, { color: theme?.textColor }]}>poops/day</Text>
      </View>
    );
  };

  const renderTotalPoopsStat = () => {
    const totalPoops = poopStats?.totalPoops;

    return (
      <View style={[styles.statCard, { backgroundColor: theme?.cardColor }]} testID={generateTestID('total-poops-stat')}>
        <LinearGradient
          colors={[theme?.accentColor, theme?.secondaryAccent]}
          style={styles.gradientHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.statTitle}>Total Poops Recorded</Text>
          <Ionicons name="ios-poop" size={24} color={theme?.textColor} />
        </LinearGradient>
        <Text style={[styles.statValue, { color: theme?.textColor }]}>
          {totalPoops !== null ? totalPoops : 'N/A'}
        </Text>
        <Text style={[styles.statUnit, { color: theme?.textColor }]}>poops</Text>
      </View>
    );
  };

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme?.backgroundColor }]}
      contentContainerStyle={styles.contentContainer}
      testID={generateTestID('stats-screen-scrollview')}
    >
      {renderFrequencyStat()}
      {renderTotalPoopsStat()}
      {renderConsistencyChart()}
      {renderColorChart()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  statCard: {
    width: width - 40,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gradientHeader: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statValue: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 10,
  },
  statUnit: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    color: '#ccc',
  },
  chartContainer: {
    width: width - 40,
    backgroundColor: '#212121',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  legendContainer: {
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
  },
  emptyChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyChartText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default StatsScreen;
