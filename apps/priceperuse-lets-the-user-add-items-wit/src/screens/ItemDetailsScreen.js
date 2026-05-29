import React, { useContext, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, format } from 'date-fns';

import { AppContext } from '../context/AppContext';

const UseLogItem = ({ log, theme }) => {
  const logDate = new Date(log.timestamp);
  const safeLogDate = isNaN(logDate.getTime()) ? new Date() : logDate;

  return (
    <View style={[styles.useLogItem, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
      <Ionicons name="time-outline" size={20} color={theme.textColor} style={styles.useLogIcon} />
      <Text style={[styles.useLogText, { color: theme.textColor }]}>
        {formatDistanceToNow(safeLogDate, { addSuffix: true })}
      </Text>
    </View>
  );
};

export default function ItemDetailsScreen({ route }) {
  const { id } = route?.params ?? {};
  if (!id) return null;

  const { items, useLogs, logUse, theme } = useContext(AppContext);

  const item = (items || []).find(item => item.id === id);
  if (!item) return null;

  const itemUseLogs = (useLogs || []).filter(log => log.itemId === id);

  const pricePerUse = item.uses > 0 ? item.purchasePrice / item.uses : item.purchasePrice;

  const handleLogUse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logUse?.(item.id);
  };

  const d = new Date(item.datePurchased);
  const safeDate = isNaN(d.getTime()) ? new Date() : d;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <LinearGradient
        colors={[theme.accentColor, theme.secondaryAccent]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerText}>{item?.name ?? 'Item Details'}</Text>
      </LinearGradient>

      <View style={styles.itemInfoContainer}>
        <View style={[styles.itemInfoCard, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
          <Ionicons name="information-circle-outline" size={24} color={theme.accentColor} style={styles.infoIcon} testID={`item-info-icon-${item.id}`} />
          <Text style={[styles.itemInfoTitle, { color: theme.textColor }]} testID={`item-info-title-${item.id}`}>Item Information</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.itemInfoLabel, { color: theme.textColor }]}>Name:</Text>
            <Text style={[styles.itemInfoValue, { color: theme.textColor }]} testID={`item-info-name-${item.id}`}>{item?.name ?? 'Unknown'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.itemInfoLabel, { color: theme.textColor }]}>Purchase Price:</Text>
            <Text style={[styles.itemInfoValue, { color: theme.textColor }]} testID={`item-info-purchase-price-${item.id}`}>${item?.purchasePrice?.toFixed(2) ?? '0.00'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.itemInfoLabel, { color: theme.textColor }]}>Price per Use:</Text>
            <Text style={[styles.itemInfoValue, { color: theme.textColor }]} testID={`item-info-price-per-use-${item.id}`}>${pricePerUse?.toFixed(2) ?? '0.00'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.itemInfoLabel, { color: theme.textColor }]}>Date Purchased:</Text>
            <Text style={[styles.itemInfoValue, { color: theme.textColor }]}>{format(safeDate, 'MMM d, yyyy')}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logUseButton, { backgroundColor: theme.secondaryAccent, borderRadius: theme.borderRadius }]}
          onPress={handleLogUse}
          testID={`log-use-button-${item.id}`}
          accessibilityLabel={`Log use for ${item.name}`}
        >
          <Ionicons name="add-circle-outline" size={24} color={theme.textColor} style={styles.logUseIcon} />
          <Text style={[styles.logUseButtonText, { color: theme.textColor }]}>Log Use</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.useLogContainer}>
        <Text style={[styles.useLogTitle, { color: theme.textColor }]}>Use Log</Text>
        {itemUseLogs.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="document-outline" size={48} color={theme.textColor} style={styles.emptyStateIcon} />
            <Text style={[styles.emptyStateText, { color: theme.textColor }]}>No uses logged yet.</Text>
          </View>
        ) : (
          <FlatList
            data={itemUseLogs}
            keyExtractor={(log) => log.id}
            renderItem={({ item: log }) => <UseLogItem log={log} theme={theme} />}
            testID={`use-log-list-${item.id}`}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  headerGradient: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  itemInfoContainer: {
    marginBottom: 20,
  },
  itemInfoCard: {
    padding: 15,
    marginBottom: 15,
  },
  infoIcon: {
    marginBottom: 5,
  },
  itemInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  itemInfoLabel: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  itemInfoValue: {
    flex: 1,
    textAlign: 'right',
  },
  logUseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
  },
  logUseIcon: {
    marginRight: 10,
  },
  logUseButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  useLogContainer: {
    marginBottom: 20,
  },
  useLogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  useLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 5,
    borderRadius: 8,
  },
  useLogIcon: {
    marginRight: 10,
  },
  useLogText: {
    fontSize: 14,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateIcon: {
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
