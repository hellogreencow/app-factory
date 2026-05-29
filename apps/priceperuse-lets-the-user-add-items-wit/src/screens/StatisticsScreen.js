import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { AppContext } from '../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import { Svg, Line, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const StatisticsScreen = () => {
  const { items, useLogs, theme } = useContext(AppContext);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading delay
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

  const totalSpent = (items || []).reduce((acc, item) => acc + (item?.purchasePrice ?? 0), 0);

  const mostUsedItem = (items || []).reduce((maxItem, item) => {
    if (!maxItem) return item;
    return (item?.uses ?? 0) > (maxItem?.uses ?? 0) ? item : maxItem;
  }, null);

  const generatePriceData = () => {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const formattedDate = format(date, 'yyyy-MM-dd');
      let totalPrice = 0;
      let totalUses = 0;

      (items || []).forEach(item => {
        const purchaseDate = new Date(item?.datePurchased);
        const safePurchaseDate = isNaN(purchaseDate.getTime()) ? new Date() : purchaseDate;
        const purchaseFormattedDate = format(safePurchaseDate, 'yyyy-MM-dd');

        if (purchaseFormattedDate <= formattedDate) {
          totalPrice += item?.purchasePrice ?? 0;
          totalUses += item?.uses ?? 0;
        }
      });

      const pricePerUse = totalUses > 0 ? totalPrice / totalUses : 0;
      data.push({ date: formattedDate, price: pricePerUse });
    }
    return data;
  };

  const priceData = generatePriceData();

  const renderPriceChart = () => {
    const svgHeight = 200;
    const svgWidth = 350;
    const graphHeight = svgHeight - 40;
    const graphWidth = svgWidth - 40;

    const yValues = priceData.map(item => item.price);
    const maxY = Math.max(...yValues);
    const minY = Math.min(...yValues);

    const xValues = priceData.map(item => item.date);
    const numberOfDataPoints = priceData.length;
    const xIncrement = graphWidth / (numberOfDataPoints - 1);

    const yPoint = (value) => {
      return graphHeight - ((value - minY) / (maxY - minY)) * graphHeight;
    };

    const xPoint = (index) => {
      return index * xIncrement;
    };

    let path = "";
    for (let i = 0; i < numberOfDataPoints; i++) {
      const x = xPoint(i);
      const y = yPoint(priceData[i].price);
      path += `${i === 0 ? 'M' : 'L'}${x},${y} `;
    }

    return (
      <Svg height={svgHeight} width={svgWidth} testID="price-chart">
        <Defs>
          <SvgLinearGradient id="grad" x1="0" y1={graphHeight} x2="0" y2="0">
            <Stop offset="0" stopColor={theme.accentColor} stopOpacity="0.8" />
            <Stop offset="1" stopColor={theme.cardColor} stopOpacity="0.1" />
          </SvgLinearGradient>
        </Defs>
        <Line
          x1="20"
          y1="20"
          x2="20"
          y2={svgHeight - 20}
          stroke={theme.textColor}
          strokeWidth="0.5"
        />
        <Line
          x1="20"
          y1={svgHeight - 20}
          x2={svgWidth - 20}
          y2={svgHeight - 20}
          stroke={theme.textColor}
          strokeWidth="0.5"
        />
        <path d={path} fill="none" stroke={theme.accentColor} strokeWidth="2" />
        {priceData.map((item, index) => (
          <Circle
            key={index}
            cx={xPoint(index) + 20}
            cy={yPoint(item.price) + 20}
            r="3"
            fill={theme.secondaryAccent}
          />
        ))}
      </Svg>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accentColor} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>Loading statistics...</Text>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <View style={[styles.card, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
            <LinearGradient
              colors={[theme.accentColor, theme.secondaryAccent]}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <View style={styles.cardContent}>
              <Ionicons name="stats-chart-outline" size={24} color={theme.textColor} style={styles.icon} testID="price-chart-icon" accessibilityLabel="Price Chart Icon" />
              <Text style={[styles.cardTitle, { color: theme.textColor }]} testID="price-chart-title">Price Per Use Trend (Last 7 Days)</Text>
              {renderPriceChart()}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
            <LinearGradient
              colors={[theme.accentColor, theme.secondaryAccent]}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <View style={styles.cardContent}>
              <Ionicons name="cash-outline" size={24} color={theme.textColor} style={styles.icon} testID="total-spent-icon" accessibilityLabel="Total Spent Icon" />
              <Text style={[styles.cardTitle, { color: theme.textColor }]} testID="total-spent-title">Total Spent</Text>
              <Text style={[styles.cardValue, { color: theme.textColor }]} testID="total-spent-value">${totalSpent.toFixed(2)}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
            <LinearGradient
              colors={[theme.accentColor, theme.secondaryAccent]}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <View style={styles.cardContent}>
              <Ionicons name="star-outline" size={24} color={theme.textColor} style={styles.icon} testID="most-used-item-icon" accessibilityLabel="Most Used Item Icon" />
              <Text style={[styles.cardTitle, { color: theme.textColor }]} testID="most-used-item-title">Most Used Item</Text>
              {mostUsedItem ? (
                <Text style={[styles.cardValue, { color: theme.textColor }]} testID="most-used-item-value">{mostUsedItem?.name ?? 'Unknown'} ({mostUsedItem?.uses ?? 0} uses)</Text>
              ) : (
                <Text style={[styles.emptyText, { color: theme.textColor }]} testID="most-used-item-empty">No items added yet.</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
  },
  contentContainer: {
    gap: 16,
  },
  card: {
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
  },
  cardContent: {
    padding: 16,
  },
  icon: {
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
});

export default StatisticsScreen;
